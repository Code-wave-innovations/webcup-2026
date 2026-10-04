import type { Request, Response } from "express";
import { z } from "zod";
import { audit, fieldsOf } from "../lib/audit";
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
    const district = await districtModel.create(createSchema.parse(req.body));
    await audit(req, { action: "district.created", entity: "District", entityId: district.id, label: district.name });
    res.status(201).json(district);
  },
  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const before = await districtModel.getOne(id);
    const district = await districtModel.update(id, input);
    await audit(req, { action: "district.updated", entity: "District", entityId: id, label: district.name, before, after: district, fields: fieldsOf(input) });
    res.json(district);
  },
  delete: async (req: Request, res: Response) => {
    const district = await districtModel.delete(parseId(req.params.id));
    await audit(req, { action: "district.deleted", entity: "District", entityId: district.id, label: district.name });
    res.json(district);
  },
};

export default districtController;
