import type { Request, Response } from "express";
import { z } from "zod";
import { audit } from "../lib/audit";
import prisma from "../lib/prisma";
import { badRequest } from "../lib/errors";
import { parseId, zId, zLocale } from "../lib/validation";
import { TRANSLATABLE_FIELDS, type TranslatableEntity } from "../lib/translations";

// F27: manage per-locale content. Allowed entities/fields live in TRANSLATABLE_FIELDS.

const zEntity = z.enum(Object.keys(TRANSLATABLE_FIELDS) as [TranslatableEntity, ...TranslatableEntity[]]);

const listQuerySchema = z.object({
  entity: zEntity.optional(),
  entity_id: zId.optional(),
  locale: zLocale.optional(),
});

// An empty string removes the translation for that field.
const upsertSchema = z.object({
  entity: zEntity,
  entity_id: zId,
  locale: zLocale,
  fields: z.record(z.string().max(20000)),
});

const translationController = {
  schema: (_req: Request, res: Response) => {
    res.json(TRANSLATABLE_FIELDS);
  },

  getAll: async (req: Request, res: Response) => {
    const where = listQuerySchema.parse(req.query);
    res.json(
      await prisma.contentTranslation.findMany({
        where,
        orderBy: [{ entity: "asc" }, { entity_id: "asc" }, { locale: "asc" }, { field: "asc" }],
      })
    );
  },

  upsert: async (req: Request, res: Response) => {
    const { entity, entity_id, locale, fields } = upsertSchema.parse(req.body);
    const allowed: readonly string[] = TRANSLATABLE_FIELDS[entity];
    const invalid = Object.keys(fields).filter((field) => !allowed.includes(field));
    if (invalid.length) throw badRequest(`Fields not translatable for ${entity}`, { invalid, allowed });

    const key = { entity, entity_id, locale };
    await prisma.$transaction(
      Object.entries(fields).map(([field, value]) =>
        value === ""
          ? prisma.contentTranslation.deleteMany({ where: { ...key, field } })
          : prisma.contentTranslation.upsert({
              where: { entity_entity_id_locale_field: { ...key, field } },
              create: { ...key, field, value },
              update: { value },
            })
      )
    );
    await audit(req, {
      action: "translation.updated",
      entity,
      entityId: entity_id,
      label: `${entity} #${entity_id} (${locale})`,
      changes: Object.entries(fields).map(([field, value]) => ({ field: `${field}.${locale}`, from: null, to: value === "" ? null : value })),
    });
    res.json(await prisma.contentTranslation.findMany({ where: key, orderBy: { field: "asc" } }));
  },

  delete: async (req: Request, res: Response) => {
    const deleted = await prisma.contentTranslation.delete({ where: { id: parseId(req.params.id) } });
    await audit(req, { action: "translation.deleted", entity: deleted.entity, entityId: deleted.entity_id, label: `${deleted.field} (${deleted.locale})` });
    res.json(deleted);
  },
};

export default translationController;
