import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { audit } from "../lib/audit";
import { pageMeta, paginationSchema, toSkipTake, zId } from "../lib/validation";

// F47 / F48: the audit journal, read-only. There is no route to change or delete an entry.

const zDate = z.coerce.date();

const filtersSchema = z.object({
  actor_id: zId.optional(),
  entity: z.string().trim().min(1).max(64).optional(),
  entity_id: zId.optional(),
  // exact action, or a family with a trailing dot: "request." matches request.*
  action: z.string().trim().min(1).max(64).optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

const listQuerySchema = paginationSchema.extend(filtersSchema.shape);
const statsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

// Agents read the team's work, not the security events nor anyone's IP
const HIDDEN_FROM_AGENTS: Prisma.AuditLogWhereInput = {
  NOT: [{ action: { startsWith: "security." } }, { action: { startsWith: "auth." } }],
};

const whereFor = (req: Request, filters: z.infer<typeof filtersSchema>): Prisma.AuditLogWhereInput => {
  const { actor_id, entity, entity_id, action, from, to, q } = filters;
  const and: Prisma.AuditLogWhereInput[] = [{ actor_id, entity, entity_id }];
  if (action) and.push(action.endsWith(".") ? { action: { startsWith: action } } : { action });
  if (from || to) and.push({ created_at: { gte: from, lte: to } });
  if (q) and.push({ OR: [{ entity_label: { contains: q } }, { actor_name: { contains: q } }, { action: { contains: q } }] });
  if (req.user!.role !== "ADMIN") and.push(HIDDEN_FROM_AGENTS);
  return { AND: and };
};

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const auditController = {
  list: async (req: Request, res: Response) => {
    const { page, limit, ...filters } = listQuerySchema.parse(req.query);
    const where = whereFor(req, filters);
    const { skip, take } = toSkipTake({ page, limit });
    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, orderBy: [{ created_at: "desc" }, { id: "desc" }], skip, take }),
      prisma.auditLog.count({ where }),
    ]);
    const admin = req.user!.role === "ADMIN";
    res.json({ data: admin ? rows : rows.map(({ ip: _ip, ...row }) => ({ ...row, ip: null })), meta: pageMeta({ page, limit }, total) });
  },

  // Admin: the same filters as a CSV that a spreadsheet opens with its accents (UTF-8 with BOM, « ; »)
  exportCsv: async (req: Request, res: Response) => {
    const filters = filtersSchema.parse(req.query);
    const rows = await prisma.auditLog.findMany({ where: whereFor(req, filters), orderBy: { created_at: "desc" }, take: 50_000 });
    const header = ["date", "acteur", "rôle", "action", "objet", "id", "libellé", "modifications", "détails", "ip"];
    const lines = rows.map((row) =>
      [
        row.created_at.toISOString(),
        row.actor_name ?? "Système",
        row.actor_role,
        row.action,
        row.entity,
        row.entity_id,
        row.entity_label,
        row.changes,
        row.metadata,
        row.ip,
      ]
        .map(csvCell)
        .join(";")
    );
    await audit(req, {
      action: "audit.exported",
      entity: "AuditLog",
      label: "Export du journal",
      metadata: { rows: rows.length, filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="journal-audit-${stamp}.csv"`);
    res.send(`﻿${[header.join(";"), ...lines].join("\r\n")}`);
  },

  // Admin: actions per day and per actor (overview)
  stats: async (req: Request, res: Response) => {
    const { days } = statsQuerySchema.parse(req.query);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    const rows = await prisma.auditLog.findMany({ where: { created_at: { gte: from } }, select: { created_at: true, actor_id: true, actor_name: true } });
    const key = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const perDay = new Map<string, number>();
    for (let i = 0; i < days; i++) perDay.set(key(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)), 0);
    const perActor = new Map<string, { actor_id: number | null; name: string; count: number }>();
    for (const row of rows) {
      perDay.set(key(row.created_at), (perDay.get(key(row.created_at)) ?? 0) + 1);
      const id = row.actor_id === null ? "system" : String(row.actor_id);
      const entry = perActor.get(id) ?? { actor_id: row.actor_id, name: row.actor_name ?? "Système", count: 0 };
      entry.count++;
      perActor.set(id, entry);
    }
    res.json({
      days,
      total: rows.length,
      per_day: [...perDay.entries()].map(([date, count]) => ({ date, count })),
      per_actor: [...perActor.values()].sort((a, b) => b.count - a.count),
    });
  },
};

export default auditController;
