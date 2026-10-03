import type { Request, Response } from "express";
import { z } from "zod";
import serviceCategoryModel from "../model/serviceCategory.model";
import { notFound } from "../lib/errors";
import { parseId, slugify, zSlug } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";

const createSchema = z.object({
  name: z.string().trim().min(1).max(191),
  slug: zSlug.max(180).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  icon: z.string().trim().max(191).nullable().optional(),
  sort_order: z.coerce.number().int().optional(),
});

const updateSchema = createSchema.partial();

const serviceCategoryController = {
  getAll: async (req: Request, res: Response) => {
    res.json(await translate("ServiceCategory", await serviceCategoryModel.getAll(), resolveLocale(req)));
  },
  getOne: async (req: Request, res: Response) => {
    const category = await serviceCategoryModel.getOne(req.params.idOrSlug);
    if (!category) throw notFound("Category not found");
    const locale = resolveLocale(req);
    res.json({
      ...(await translateOne("ServiceCategory", category, locale)),
      services: await translate("CityService", category.services, locale),
    });
  },
  create: async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    res.status(201).json(await serviceCategoryModel.create({ ...input, slug: input.slug ?? slugify(input.name) }));
  },
  update: async (req: Request, res: Response) => {
    res.json(await serviceCategoryModel.update(parseId(req.params.id), updateSchema.parse(req.body)));
  },
  delete: async (req: Request, res: Response) => {
    res.json(await serviceCategoryModel.delete(parseId(req.params.id)));
  },
};

export default serviceCategoryController;
