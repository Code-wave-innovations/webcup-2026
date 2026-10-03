import type { Request, Response } from "express";
import { z } from "zod";
import serviceCategoryModel from "../model/serviceCategory.model";
import { notFound } from "../lib/errors";
import { parseId, slugify, zSlug } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";
import { audit, diffChanges } from "../lib/audit";
import prisma from "../lib/prisma";

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
    await audit(req, {
      action: "category.created",
      entity: "ServiceCategory",
      entityId: category.id,
      label: category.name,
      always: true,
    });
    res.status(201).json(category);
  },
  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const before = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!before) throw notFound("Category not found");
    const category = await serviceCategoryModel.update(id, updateSchema.parse(req.body));
    await audit(req, {
      action: "category.updated",
      entity: "ServiceCategory",
      entityId: category.id,
      label: category.name,
      changes: diffChanges(before, category, ["name", "slug", "description", "icon", "sort_order"]),
    });
    res.json(category);
  },
  delete: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const before = await prisma.serviceCategory.findUnique({ where: { id }, select: { name: true } });
    if (!before) throw notFound("Category not found");
    const deleted = await serviceCategoryModel.delete(id);
    await audit(req, {
      action: "category.deleted",
      entity: "ServiceCategory",
      entityId: id,
      label: before.name,
      always: true,
    });
    res.json(deleted);
  },
};

export default serviceCategoryController;
