import type { Request, Response } from "express";
import { InterruptionImpact, InterruptionType, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { notifyUser } from "../lib/notify";
import { notEndedWhere } from "../lib/availability";
import { parseId, zDate, zId } from "../lib/validation";
import { resolveLocale, translate } from "../lib/translations";
import { audit, diffChanges } from "../lib/audit";

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
  if (startsAt && endsAt && endsAt <= startsAt) throw badRequest("ends_at must be after starts_at");
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
    let notified = 0;
    if (interruption.impact === "UNAVAILABLE") {
      const appointments = await prisma.appointment.findMany({
        where: {
          service_id: interruption.service_id,
          status: "BOOKED",
          citizen_id: { not: null },
          slot: {
            ends_at: { gt: interruption.starts_at },
            ...(interruption.ends_at ? { starts_at: { lt: interruption.ends_at } } : {}),
          },
        },
        select: { id: true, reference: true, citizen_id: true },
      });
      for (const appointment of appointments) {
        await notifyUser(appointment.citizen_id!, {
          type: "SERVICE_INTERRUPTION",
          title: `${interruption.service.name} indisponible pendant votre rendez-vous ${appointment.reference}`,
          body: [interruption.reason, interruption.alternative].filter(Boolean).join("\n"),
          link: `/appointments/${appointment.id}`,
          data: { interruption_id: interruption.id, appointment_id: appointment.id },
        });
      }
      notified = appointments.length;
    }
    await audit(req, {
      action: "interruption.created",
      entity: "ServiceInterruption",
      entityId: interruption.id,
      label: interruption.service.name,
      changes: [
        { field: "impact", to: interruption.impact },
        { field: "type", to: interruption.type },
      ],
      metadata: { notified },
      always: true,
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
    await audit(req, {
      action: "interruption.updated",
      entity: "ServiceInterruption",
      entityId: id,
      label: interruption.service.name,
      changes: diffChanges(current, interruption, ["type", "impact", "reason", "alternative", "starts_at", "ends_at"]),
    });
    res.json(interruption);
  },

  // The service is back: close the interruption now.
  end: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const interruption = await prisma.serviceInterruption.update({
      where: { id },
      data: { ends_at: new Date() },
      include,
    });
    await audit(req, {
      action: "interruption.ended",
      entity: "ServiceInterruption",
      entityId: id,
      label: interruption.service.name,
      always: true,
    });
    res.json(interruption);
  },

  delete: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const current = await prisma.serviceInterruption.findUnique({ where: { id }, include });
    if (!current) throw notFound("Interruption not found");
    const deleted = await prisma.serviceInterruption.delete({ where: { id }, select: { id: true } });
    await audit(req, {
      action: "interruption.deleted",
      entity: "ServiceInterruption",
      entityId: id,
      label: current.service.name,
      always: true,
    });
    res.json(deleted);
  },
};

export default serviceInterruptionController;
