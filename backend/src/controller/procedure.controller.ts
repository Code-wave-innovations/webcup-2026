import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import procedureModel from "../model/procedure.model";
import { notFound } from "../lib/errors";
import { idOrSlugWhere, parseId, slugify, zBool, zId, zJson, zSlug } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { withAvailability } from "../lib/availability";

// D11 / D12: procedures citizens can start. form_schema describes the extra
// fields the frontend renders; answers are stored in CitizenRequest.data.
export const formFieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, "Field names use snake_case"),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "email", "tel", "select", "checkbox"]).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  help: z.string().optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;

const createSchema = z.object({
  service_id: zId,
  title: z.string().trim().min(1).max(191),
  slug: zSlug.max(180).optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  required_documents: zJson(z.array(z.string().min(1))).nullable().optional(),
  form_schema: zJson(z.array(formFieldSchema)).nullable().optional(),
  estimated_days: z.coerce.number().int().min(0).nullable().optional(),
  is_active: zBool.optional(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({ service_id: zId.optional() });

const toJson = (value: unknown[] | null | undefined) =>
  value === undefined ? undefined : value === null ? Prisma.DbNull : (value as Prisma.InputJsonArray);

const procedureController = {
  getAll: async (req: Request, res: Response) => {
    const { service_id } = listQuerySchema.parse(req.query);
    const procedures = await procedureModel.getAll({
      service_id,
      ...(isStaff(req.user) ? {} : { is_active: true }),
    });
    res.json(await translate("Procedure", procedures, resolveLocale(req)));
  },

  getOne: async (req: Request, res: Response) => {
    const procedure = await procedureModel.getOne({
      ...idOrSlugWhere(req.params.idOrSlug),
      ...(isStaff(req.user) ? {} : { is_active: true }),
    });
    if (!procedure) throw notFound("Procedure not found");
    // F38: tell the citizen before they start if the service is interrupted
    const translated = await translateOne("Procedure", procedure, resolveLocale(req));
    res.json({ ...translated, service: withAvailability(procedure.service) });
  },

  create: async (req: Request, res: Response) => {
    const { required_documents, form_schema, ...input } = createSchema.parse(req.body);
    const procedure = await procedureModel.create({
      ...input,
      slug: input.slug ?? slugify(input.title),
      required_documents: toJson(required_documents),
      form_schema: toJson(form_schema),
    });
    res.status(201).json(procedure);
  },

  update: async (req: Request, res: Response) => {
    const { required_documents, form_schema, ...input } = updateSchema.parse(req.body);
    const procedure = await procedureModel.update(parseId(req.params.id), {
      ...input,
      required_documents: toJson(required_documents),
      form_schema: toJson(form_schema),
    });
    res.json(procedure);
  },

  delete: async (req: Request, res: Response) => {
    res.json(await procedureModel.delete(parseId(req.params.id)));
  },
};

export default procedureController;
