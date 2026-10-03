import type { Request, Response } from "express";
import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { audit, type AuditChange } from "../lib/audit";
import { badRequest } from "../lib/errors";
import { pageMeta, paginationSchema, toSkipTake, zBool, zId } from "../lib/validation";

// F47 / F48: read-only journal. This router never updates or deletes a row.

const MAX_EXPORT = 10_000;

const SENSITIVE_ACTIONS = [
  "user.role_changed",
  "user.deactivated",
  "user.deleted",
  "user.login_unlocked",
  "user.self_deleted",
  "settings.updated",
  "auth.staff_login",
  "security.new_device",
  "security.sessions_revoked",
  "security.2fa_enabled",
  "security.2fa_reset",
  "security.passkey_added",
  "security.passkey_revoked",
];

const entityList = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",").map((part) => part.trim()).filter(Boolean) : value),
  z.array(z.string().max(64)).max(12).optional()
);

const filterSchema = z.object({
  actor_id: zId.optional(),
  entity: entityList,
  entity_id: zId.optional(),
  action: z.string().trim().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

const listQuerySchema = filterSchema.merge(paginationSchema).extend({
  summary: zBool.optional(),
  facets: zBool.optional(),
});

type Filters = z.infer<typeof filterSchema>;

type AuditRow = {
  id: number;
  created_at: Date;
  actor_id: number | null;
  actor_role: Role | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  entity_label: string | null;
  changes: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  ip: string | null;
};

const isAdmin = (req: Request) => req.user!.role === "ADMIN";

const buildWhere = (req: Request, filters: Filters): Prisma.AuditLogWhereInput => {
  if (filters.from && filters.to && filters.from > filters.to) throw badRequest("`from` must be before `to`");

  const and: Prisma.AuditLogWhereInput[] = [];
  // Agents see the team's work. Security-desk rows stay with administrators.
  if (!isAdmin(req)) and.push({ NOT: { action: { startsWith: "security." } } });
  if (filters.action) and.push({ action: filters.action });

  const where: Prisma.AuditLogWhereInput = {};
  if (filters.actor_id !== undefined) where.actor_id = filters.actor_id;
  if (filters.entity?.length === 1) where.entity = filters.entity[0];
  else if (filters.entity && filters.entity.length > 1) where.entity = { in: filters.entity };
  if (filters.entity_id !== undefined) where.entity_id = filters.entity_id;
  if (filters.from || filters.to) {
    where.created_at = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.q) {
    const or: Prisma.AuditLogWhereInput[] = [
      { actor_name: { contains: filters.q } },
      { entity_label: { contains: filters.q } },
      { action: { contains: filters.q } },
      { entity: { contains: filters.q } },
      { changes: { string_contains: filters.q } },
    ];
    if (isAdmin(req)) or.push({ ip: { contains: filters.q } });
    and.push({ OR: or });
  }
  if (and.length) where.AND = and;
  return where;
};

const present = (row: AuditRow, admin: boolean) => ({
  id: row.id,
  created_at: row.created_at,
  actor_id: row.actor_id,
  actor_role: row.actor_role,
  actor_name: row.actor_name,
  action: row.action,
  entity: row.entity,
  entity_id: row.entity_id,
  entity_label: row.entity_label,
  changes: Array.isArray(row.changes) ? (row.changes as AuditChange[]) : [],
  metadata: row.metadata ?? null,
  ...(admin ? { ip: row.ip } : {}),
});

const visibilityWhere = (req: Request): Prisma.AuditLogWhereInput => (isAdmin(req) ? {} : { NOT: { action: { startsWith: "security." } } });

const ACTION_FR: Record<string, string> = {
  "request.status_changed": "Changement d'état",
  "request.assigned": "Assignation",
  "request.priority_changed": "Changement de priorité",
  "request.internal_note": "Note interne",
  "request.comment_added": "Message",
  "request.deleted": "Suppression de demande",
  "user.created": "Création de compte",
  "user.updated": "Modification de compte",
  "user.role_changed": "Changement de rôle",
  "user.deactivated": "Désactivation",
  "user.reactivated": "Réactivation",
  "user.deleted": "Suppression de compte",
  "user.login_unlocked": "Déverrouillage",
  "user.self_deleted": "Suppression par l'habitant",
  "service.created": "Création de service",
  "service.updated": "Modification de service",
  "service.featured": "Mise en avant",
  "service.disabled": "Mise hors ligne",
  "service.enabled": "Mise en ligne",
  "service.deleted": "Suppression de service",
  "settings.updated": "Paramètres",
  "auth.staff_login": "Connexion du personnel",
  "audit.exported": "Export du journal",
};

const FIELD_FR: Record<string, string> = {
  status: "état",
  priority: "priorité",
  assigned_agent_id: "agent",
  is_featured: "mise en avant",
  is_active: "actif",
  role: "rôle",
  severity: "gravité",
  audience: "audience",
  impact: "impact",
  phone: "téléphone",
  address: "adresse",
  name: "nom",
  title: "titre",
};

const VALUE_FR: Record<string, string> = {
  SUBMITTED: "Nouvelle",
  IN_REVIEW: "En examen",
  IN_PROGRESS: "En traitement",
  WAITING_CITIZEN: "Attente citoyen",
  RESOLVED: "Résolue",
  REJECTED: "Refusée",
  CLOSED: "Clôturée",
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
  CITIZEN: "Citoyen",
  AGENT: "Agent",
  ADMIN: "Administrateur",
  INFO: "Information",
  WARNING: "Vigilance",
  CRITICAL: "Critique",
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  ARCHIVED: "Archivée",
  BOOKED: "Confirmé",
  CANCELLED: "Annulé",
  COMPLETED: "Honoré",
  NO_SHOW: "Absent",
  DEGRADED: "Service dégradé",
  UNAVAILABLE: "Indisponible",
  MAINTENANCE: "Maintenance",
  INCIDENT: "Incident",
  DISRUPTED: "Perturbée",
  INTERRUPTED: "Interrompue",
  true: "oui",
  false: "non",
};

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const labelValue = (value: string | null | undefined) => (value ? (VALUE_FR[value] ?? value) : "");

const formatChanges = (changes: AuditChange[]) =>
  changes
    .map((change) => {
      const field = FIELD_FR[change.field] ?? change.field;
      if (change.masked) return `${field} modifié`;
      const from = labelValue(change.from);
      const to = labelValue(change.to);
      return from ? `${field}: ${from} → ${to}` : `${field}: ${to}`;
    })
    .join(" | ");

const auditController = {
  list: async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const { summary, facets, page, limit, ...filters } = query;
    const where = buildWhere(req, filters);
    const admin = isAdmin(req);
    const { skip, take } = toSkipTake({ page, limit });

    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, orderBy: [{ created_at: "desc" }, { id: "desc" }], skip, take }),
      prisma.auditLog.count({ where }),
    ]);

    const visible = visibilityWhere(req);
    const [summaryCounts, actors] = await Promise.all([
      summary
        ? Promise.all([
            prisma.auditLog.count({ where: visible }),
            prisma.auditLog.count({ where: { ...visible, created_at: { gte: new Date(Date.now() - 3_600_000) } } }),
            prisma.auditLog.count({ where: { ...visible, action: { in: SENSITIVE_ACTIONS } } }),
          ])
        : null,
      facets
        ? prisma.auditLog.groupBy({
            by: ["actor_id", "actor_name", "actor_role"],
            where: buildWhere(req, { ...filters, actor_id: undefined, q: undefined }),
            _count: { _all: true },
          })
        : null,
    ]);

    res.json({
      data: rows.map((row) => present(row, admin)),
      meta: pageMeta({ page, limit }, total),
      ...(summaryCounts
        ? { summary: { total: summaryCounts[0], last_hour: summaryCounts[1], sensitive: summaryCounts[2] } }
        : {}),
      ...(actors
        ? {
            actors: actors
              .sort((a, b) => b._count._all - a._count._all)
              .slice(0, 100)
              .map(({ actor_id, actor_name, actor_role }) => ({ actor_id, actor_name, actor_role })),
          }
        : {}),
    });
  },

  // Same filters as the list. UTF-8 with a BOM so Excel keeps the accents.
  exportCsv: async (req: Request, res: Response) => {
    const filters = filterSchema.parse(req.query);
    const where = buildWhere(req, filters);
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: MAX_EXPORT + 1,
    });
    const truncated = rows.length > MAX_EXPORT;
    const exported = truncated ? rows.slice(0, MAX_EXPORT) : rows;

    const lines = [
      ["date", "auteur", "rôle", "action", "entité", "libellé", "changements", "ip"].join(";"),
      ...exported.map((row) =>
        [
          row.created_at.toISOString(),
          row.actor_name ?? "Système",
          row.actor_role ? (VALUE_FR[row.actor_role] ?? row.actor_role) : "",
          ACTION_FR[row.action] ?? row.action,
          row.entity,
          row.entity_label ?? "",
          formatChanges(Array.isArray(row.changes) ? (row.changes as AuditChange[]) : []),
          row.ip ?? "",
        ]
          .map(csvCell)
          .join(";")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="journal-audit.csv"');
    if (truncated) res.setHeader("X-Export-Truncated", "1");
    res.send(`\uFEFF${lines.join("\r\n")}`);

    await audit(req, {
      action: "audit.exported",
      entity: "AuditLog",
      label: "Journal d'audit",
      metadata: {
        rows: exported.length,
        truncated,
        filters: {
          actor_id: filters.actor_id ?? null,
          entity: filters.entity ?? null,
          action: filters.action ?? null,
          from: filters.from?.toISOString() ?? null,
          to: filters.to?.toISOString() ?? null,
          q: filters.q ?? null,
        },
      },
      always: true,
    });
  },

  // Actions per day and per actor, for the admin overview (BO-02).
  stats: async (req: Request, res: Response) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }).parse(req.query);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [byDayRows, byActorRows] = await Promise.all([
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM AuditLog
        WHERE created_at >= ${start}
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY day ASC
      `,
      prisma.auditLog.groupBy({
        by: ["actor_id", "actor_name"],
        where: { created_at: { gte: start } },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map(byDayRows.map((row) => [row.day, Number(row.count)]));
    const by_day: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      by_day.push({ date, count: counts.get(date) ?? 0 });
    }

    res.json({
      days,
      from: start.toISOString(),
      by_day,
      by_actor: byActorRows
        .map((row) => ({
          actor_id: row.actor_id,
          actor_name: row.actor_name ?? "Système",
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    });
  },
};

export default auditController;
