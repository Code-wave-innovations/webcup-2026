import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import cityServiceModel, { SERVICE_ORDER } from "../model/cityService.model";
import { notFound } from "../lib/errors";
import {
  idOrSlugWhere,
  pageMeta,
  paginationSchema,
  parseId,
  slugify,
  toSkipTake,
  zBool,
  zId,
  zSlug,
} from "../lib/validation";
import { resolveLocale, searchTranslatedIds, translate, translateServices } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { withAvailability } from "../lib/availability";
import { audit, diffChanges } from "../lib/audit";
import prisma from "../lib/prisma";

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

const SERVICE_FIELDS = [
  "name",
  "slug",
  "category_id",
  "summary",
  "description",
  "keywords",
  "icon",
  "contact_email",
  "contact_phone",
  "address",
  "opening_hours",
  "external_url",
  "is_featured",
  "priority",
  "is_active",
] as const;

const serviceAction = (changes: { field: string }[], active: boolean) => {
  const keys = new Set(changes.map((change) => change.field));
  if (keys.size === 1 && keys.has("is_featured")) return "service.featured";
  if (keys.size === 1 && keys.has("is_active")) return active ? "service.enabled" : "service.disabled";
  return "service.updated";
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

    // F28: usage counter used to surface the most consulted services
    await cityServiceModel.incrementViews(service.id);

    const locale = resolveLocale(req);
    const [translated] = await translateServices([service], locale);
    res.json({
      ...withAvailability(translated),
      view_count: service.view_count + 1,
      procedures: await translate("Procedure", service.procedures, locale),
    });
  },

  create: async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    const service = await cityServiceModel.create({ ...input, slug: input.slug ?? slugify(input.name) });
    await audit(req, {
      action: "service.created",
      entity: "CityService",
      entityId: service.id,
      label: service.name,
      changes: [
        { field: "priority", to: String(service.priority) },
        { field: "is_active", to: String(service.is_active) },
      ],
      always: true,
    });
    res.status(201).json(service);
  },

  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const before = await prisma.cityService.findUnique({ where: { id } });
    if (!before) throw notFound("Service not found");
    const service = await cityServiceModel.update(id, input);
    const changes = diffChanges(before, service, SERVICE_FIELDS);
    await audit(req, {
      action: serviceAction(changes, service.is_active),
      entity: "CityService",
      entityId: service.id,
      label: service.name,
      changes,
    });
    res.json(service);
  },

  delete: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const before = await prisma.cityService.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!before) throw notFound("Service not found");
    const deleted = await cityServiceModel.delete(id);
    await audit(req, {
      action: "service.deleted",
      entity: "CityService",
      entityId: id,
      label: before.name,
      always: true,
    });
    res.json(deleted);
  },
};

export default cityServiceController;
