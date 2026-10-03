import type { Request, Response } from "express";
import { z } from "zod";
import districtModel from "../model/district.model";
import { notFound } from "../lib/errors";
import { parseId } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";

const createSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(5000).nullable().optional(),
});

const updateSchema = createSchema.partial();

const districtController = {
  getAll: async (req: Request, res: Response) => {
    res.json(await translate("District", await districtModel.getAll(), resolveLocale(req)));
  },
  getOne: async (req: Request, res: Response) => {
    const district = await districtModel.getOne(parseId(req.params.id));
    if (!district) throw notFound("District not found");
    res.json(await translateOne("District", district, resolveLocale(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await districtModel.create(createSchema.parse(req.body)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await districtModel.update(parseId(req.params.id), updateSchema.parse(req.body)));
  },
  delete: async (req: Request, res: Response) => {
    res.json(await districtModel.delete(parseId(req.params.id)));
  },
};

export default districtController;
