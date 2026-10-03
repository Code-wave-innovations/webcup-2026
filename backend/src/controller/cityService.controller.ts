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
    res.status(201).json(await cityServiceModel.create({ ...input, slug: input.slug ?? slugify(input.name) }));
  },

  update: async (req: Request, res: Response) => {
    res.json(await cityServiceModel.update(parseId(req.params.id), updateSchema.parse(req.body)));
  },

  delete: async (req: Request, res: Response) => {
    res.json(await cityServiceModel.delete(parseId(req.params.id)));
  },
};

export default cityServiceController;
