import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { audit, fieldsOf } from "../lib/audit";
import cityServiceModel, { SERVICE_ORDER } from "../model/cityService.model";
import { notFound } from "../lib/errors";
import { warnAppointments } from "../lib/interruptions";
import { notifyUser } from "../lib/notify";
import { OPEN_STATUSES } from "../model/citizenRequest.model";
import {
  idOrSlugWhere,
  pageMeta,
  paginationSchema,
  fieldError,
  parseId,
  slugify,
  toSkipTake,
  zBool,
  zId,
  zSlug,
} from "../lib/validation";
import { resolveLocale, searchTranslatedIds, translate, translateServices } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { notEndedWhere, withAvailability } from "../lib/availability";

// D05 service catalog, F28 featured services, F32 search, F27 translations

const listQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category: z.string().trim().min(1).optional(),
  featured: zBool.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["default", "popular", "name"]).default("default"),
  include_inactive: zBool.optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(191),
  slug: zSlug.max(180).optional(),
  category_id: zId.nullable().optional(),
  summary: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20000).nullable().optional(),
  keywords: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(191).nullable().optional(),
  contact_email: z.string().trim().email().max(191).nullable().optional(),
  contact_phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(191).nullable().optional(),
  opening_hours: z.string().trim().max(191).nullable().optional(),
  external_url: z.string().trim().url().max(191).nullable().optional(),
  is_featured: zBool.optional(),
  priority: z.coerce.number().int().optional(),
  is_active: zBool.optional(),
});

const updateSchema = createSchema.partial();

// F63: cutting a service keeps it visible as « Indisponible », with why, what to do and when to come back
const disableSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  alternative: z.string().trim().max(2000).nullable().optional(),
  back_at: z.coerce.date().nullable().optional(),
  notify_open_requests: zBool.default(false),
});

const loadService = async (id: number) => {
  const service = await prisma.cityService.findUnique({ where: { id } });
  if (!service) throw notFound("Service not found");
  return service;
};

// What a cut would touch (shown before cutting)
const impactOf = async (serviceId: number) => {
  const now = new Date();
  const [upcoming_appointments, open_requests, open_procedures] = await Promise.all([
    prisma.appointment.count({ where: { service_id: serviceId, status: "BOOKED", slot: { starts_at: { gte: now } } } }),
    prisma.citizenRequest.count({ where: { service_id: serviceId, status: { in: OPEN_STATUSES } } }),
    prisma.procedure.count({ where: { service_id: serviceId, is_active: true } }),
  ]);
  return { upcoming_appointments, open_requests, open_procedures };
};

const cityServiceController = {
  getAll: async (req: Request, res: Response) => {
    const { category, featured, q, sort, include_inactive, ...pagination } = listQuerySchema.parse(req.query);
    const locale = resolveLocale(req);

    const where: Prisma.CityServiceWhereInput = {};
    if (!(include_inactive && isStaff(req.user))) where.is_active = true;
    if (category) where.category = idOrSlugWhere(category);
    if (featured !== undefined) where.is_featured = featured;
    if (q) {
      const translatedIds = await searchTranslatedIds("CityService", locale, q);
      where.OR = [
        { name: { contains: q } },
        { summary: { contains: q } },
        { keywords: { contains: q } },
        { description: { contains: q } },
        { category: { name: { contains: q } } },
        ...(translatedIds.length ? [{ id: { in: translatedIds } }] : []),
      ];
    }

    const { skip, take } = toSkipTake(pagination);
    const [services, total] = await cityServiceModel.list(where, SERVICE_ORDER[sort], skip, take);
    res.json({
      data: (await translateServices(services, locale)).map(withAvailability),
      meta: pageMeta(pagination, total),
    });
  },

  getOne: async (req: Request, res: Response) => {
    const where: Prisma.CityServiceWhereInput = idOrSlugWhere(req.params.idOrSlug);
    if (!isStaff(req.user)) where.is_active = true;
    const service = await cityServiceModel.getOne(where);
    if (!service) throw notFound("Service not found");

    // F28: only a resident's visit counts. Staff reading a sheet must not inflate "most used".
    const counted = !isStaff(req.user);
    if (counted) await cityServiceModel.incrementViews(service.id);

    const locale = resolveLocale(req);
    const [translated] = await translateServices([service], locale);
    res.json({
      ...withAvailability(translated),
      view_count: service.view_count + (counted ? 1 : 0),
      procedures: await translate("Procedure", service.procedures, locale),
    });
  },

  create: async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    const service = await cityServiceModel.create({ ...input, slug: input.slug ?? slugify(input.name) });
    await audit(req, { action: "service.created", entity: "CityService", entityId: service.id, label: service.name });
    res.status(201).json(service);
  },

  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const before = await prisma.cityService.findUnique({ where: { id } });
    const service = await cityServiceModel.update(id, input);
    // F28: putting a service forward has its own action; everything else is one "updated" entry
    const fields = fieldsOf(input);
    const target = { entity: "CityService", entityId: id, label: service.name, before, after: service };
    if (fields.includes("is_featured") && before?.is_featured !== service.is_featured) {
      await audit(req, { ...target, action: "service.featured", fields: ["is_featured"] });
    }
    const rest = fields.filter((field) => field !== "is_featured");
    if (rest.length) await audit(req, { ...target, action: "service.updated", fields: rest });
    res.json(service);
  },

  // F63: what cutting this service would touch
  impact: async (req: Request, res: Response) => {
    const service = await loadService(parseId(req.params.id));
    res.json(await impactOf(service.id));
  },

  // F63: cut a faulty service now, in one action (admin). It stays in the catalogue, shown as
  // unavailable with the reason, the alternative and the return time; requests and bookings are refused.
  disable: async (req: Request, res: Response) => {
    const service = await loadService(parseId(req.params.id));
    const { reason, alternative, back_at, notify_open_requests } = disableSchema.parse(req.body);
    const now = new Date();
    if (back_at && back_at <= now) throw fieldError("back_at", "back_at must be in the future");
    const interruption = await prisma.serviceInterruption.create({
      data: {
        service_id: service.id,
        type: "INCIDENT",
        impact: "UNAVAILABLE",
        reason,
        alternative: alternative ?? null,
        starts_at: now,
        ends_at: back_at ?? null,
        created_by_id: req.user!.id,
      },
      include: { service: { select: { id: true, slug: true, name: true } } },
    });
    const notifiedAppointments = await warnAppointments(interruption);

    let notifiedRequests = 0;
    if (notify_open_requests) {
      const requests = await prisma.citizenRequest.findMany({
        where: { service_id: service.id, status: { in: OPEN_STATUSES }, citizen_id: { not: null } },
        select: { id: true, reference: true, citizen_id: true },
      });
      for (const request of requests) {
        await notifyUser(request.citizen_id!, {
          type: "SERVICE_INTERRUPTION",
          title: `${service.name} est momentanément indisponible`,
          body: [`Votre demande ${request.reference} reste enregistrée.`, reason, alternative].filter(Boolean).join("\n"),
          link: `/requests/${request.id}`,
          data: { interruption_id: interruption.id, request_id: request.id },
        });
      }
      notifiedRequests = requests.length;
    }

    const notified = notifiedAppointments + notifiedRequests;
    await audit(req, {
      action: "service.disabled",
      entity: "CityService",
      entityId: service.id,
      label: service.name,
      changes: [{ field: "availability", from: "AVAILABLE", to: "UNAVAILABLE" }],
      metadata: { reason, alternative: alternative ?? null, back_at: back_at ?? null, notified_appointments: notifiedAppointments, notified_requests: notifiedRequests },
    });
    res.status(201).json({ interruption, notified, notified_appointments: notifiedAppointments, notified_requests: notifiedRequests });
  },

  // F63: the service is back: every ongoing interruption ends now
  enable: async (req: Request, res: Response) => {
    const service = await loadService(parseId(req.params.id));
    const now = new Date();
    const { count } = await prisma.serviceInterruption.updateMany({
      where: { service_id: service.id, starts_at: { lte: now }, ...notEndedWhere() },
      data: { ends_at: now },
    });
    await audit(req, {
      action: "service.enabled",
      entity: "CityService",
      entityId: service.id,
      label: service.name,
      changes: [{ field: "availability", from: "UNAVAILABLE", to: "AVAILABLE" }],
      metadata: { ended_interruptions: count },
    });
    res.json({ ended: count });
  },

  delete: async (req: Request, res: Response) => {
    const service = await cityServiceModel.delete(parseId(req.params.id));
    await audit(req, { action: "service.deleted", entity: "CityService", entityId: service.id, label: service.name });
    res.json(service);
  },
};

export default cityServiceController;
