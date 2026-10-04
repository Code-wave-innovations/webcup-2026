import type { Request, Response } from "express";
import { audit, fieldsOf } from "../lib/audit";
import { warnAppointments } from "../lib/interruptions";
import { InterruptionImpact, InterruptionType, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { userHasPermission } from "../lib/roleGrants";
import { notEndedWhere } from "../lib/availability";
import { fieldError, parseId, zDate, zId } from "../lib/validation";
import { resolveLocale, translate } from "../lib/translations";

// F38: maintenance windows and incidents making a service unavailable.

const include = {
  service: { select: { id: true, slug: true, name: true } },
  created_by: { select: { id: true, name: true, last_name: true } },
} satisfies Prisma.ServiceInterruptionInclude;

const listQuerySchema = z.object({
  service_id: zId.optional(),
  // current: ongoing now · upcoming: planned · active: current + upcoming (default) · all: history too
  scope: z.enum(["current", "upcoming", "active", "all"]).default("active"),
});

const createSchema = z.object({
  service_id: zId,
  type: z.nativeEnum(InterruptionType).optional(),
  impact: z.nativeEnum(InterruptionImpact).optional(),
  reason: z.string().trim().min(3).max(5000),
  alternative: z.string().trim().max(5000).nullable().optional(),
  starts_at: zDate.optional(),
  ends_at: zDate.nullable().optional(),
});

const updateSchema = createSchema.omit({ service_id: true }).partial();

const checkDates = (startsAt?: Date, endsAt?: Date | null) => {
  if (startsAt && endsAt && endsAt <= startsAt) throw fieldError("ends_at", "ends_at must be after starts_at");
};

const scopeWhere = (scope: string): Prisma.ServiceInterruptionWhereInput => {
  const now = new Date();
  if (scope === "current") return { starts_at: { lte: now }, ...notEndedWhere() };
  if (scope === "upcoming") return { starts_at: { gt: now } };
  if (scope === "active") return notEndedWhere();
  return {};
};

const serviceInterruptionController = {
  getAll: async (req: Request, res: Response) => {
    const { service_id, scope } = listQuerySchema.parse(req.query);
    // History (ended interruptions) follows interruptions.manage (D09).
    if (scope === "all" && !(req.user && (await userHasPermission(req.user.role, "interruptions.manage")))) {
      throw forbidden("Full interruption history is reserved for staff");
    }
    const rows = await prisma.serviceInterruption.findMany({
      where: { service_id, ...scopeWhere(scope) },
      orderBy: { starts_at: scope === "all" ? "desc" : "asc" },
      include,
      take: 200,
    });
    res.json(await translate("ServiceInterruption", rows, resolveLocale(req)));
  },

  create: async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    checkDates(input.starts_at ?? new Date(), input.ends_at);
    const interruption = await prisma.serviceInterruption.create({
      data: { ...input, created_by_id: req.user!.id },
      include,
    });

    // Citizens with an appointment during the interruption are warned right away.
    const notified = await warnAppointments(interruption);
    await audit(req, {
      action: "interruption.created",
      entity: "ServiceInterruption",
      entityId: interruption.id,
      label: interruption.service.name,
      after: interruption,
      fields: ["type", "impact", "reason", "alternative", "starts_at", "ends_at"],
      metadata: { service_id: interruption.service_id, notified },
    });
    res.status(201).json({ ...interruption, notified });
  },

  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const current = await prisma.serviceInterruption.findUnique({ where: { id } });
    if (!current) throw notFound("Interruption not found");
    checkDates(input.starts_at ?? current.starts_at, input.ends_at === undefined ? current.ends_at : input.ends_at);
    const interruption = await prisma.serviceInterruption.update({ where: { id }, data: input, include });
    await audit(req, { action: "interruption.updated", entity: "ServiceInterruption", entityId: id, label: interruption.service.name, before: current, after: interruption, fields: fieldsOf(input) });
    res.json(interruption);
  },

  // The service is back: close the interruption now.
  end: async (req: Request, res: Response) => {
    const interruption = await prisma.serviceInterruption.update({
      where: { id: parseId(req.params.id) },
      data: { ends_at: new Date() },
      include,
    });
    await audit(req, { action: "interruption.ended", entity: "ServiceInterruption", entityId: interruption.id, label: interruption.service.name });
    res.json(interruption);
  },

  delete: async (req: Request, res: Response) => {
    const deleted = await prisma.serviceInterruption.delete({ where: { id: parseId(req.params.id) }, include });
    await audit(req, { action: "interruption.deleted", entity: "ServiceInterruption", entityId: deleted.id, label: deleted.service.name, metadata: { reason: deleted.reason } });
    res.json({ id: deleted.id });
  },
};

export default serviceInterruptionController;
