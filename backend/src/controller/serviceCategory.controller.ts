import type { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { audit, fieldsOf } from "../lib/audit";
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
    const category = await serviceCategoryModel.create({ ...input, slug: input.slug ?? slugify(input.name) });
    await audit(req, { action: "category.created", entity: "ServiceCategory", entityId: category.id, label: category.name });
    res.status(201).json(category);
  },
  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const before = await prisma.serviceCategory.findUnique({ where: { id } });
    const category = await serviceCategoryModel.update(id, input);
    await audit(req, { action: "category.updated", entity: "ServiceCategory", entityId: id, label: category.name, before, after: category, fields: fieldsOf(input) });
    res.json(category);
  },
  delete: async (req: Request, res: Response) => {
    const category = await serviceCategoryModel.delete(parseId(req.params.id));
    await audit(req, { action: "category.deleted", entity: "ServiceCategory", entityId: category.id, label: category.name });
    res.json(category);
  },
};

export default serviceCategoryController;
