import type { Request } from "express";
import prisma from "./prisma";

export const DEFAULT_LOCALE = "fr";

// F27: entities and fields that can be translated through ContentTranslation.
// To make a new entity translatable, add its Prisma model name and text fields here.
export const TRANSLATABLE_FIELDS = {
  CityService: ["name", "summary", "description", "opening_hours"],
  ServiceCategory: ["name", "description"],
  Procedure: ["title", "description"],
  Announcement: ["title", "summary", "content"],
  Alert: ["title", "message", "instructions"],
  District: ["name", "description"],
  ServiceInterruption: ["reason", "alternative"],
  TransitLine: ["name", "description", "status_message"],
} as const;

export type TranslatableEntity = keyof typeof TRANSLATABLE_FIELDS;

const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

// ?lang= wins, then the logged-in user's preference, then Accept-Language.
export const resolveLocale = (req: Request): string => {
  const lang = req.query.lang;
  if (typeof lang === "string" && LOCALE_RE.test(lang)) return lang;
  if (req.user?.locale) return req.user.locale;
  const header = req.headers["accept-language"]?.slice(0, 2).toLowerCase();
  return header && LOCALE_RE.test(header) ? header : DEFAULT_LOCALE;
};

// Overlays translated fields on the rows; untranslated fields keep the default-locale text.
export const translate = async <T extends { id: number }>(
  entity: TranslatableEntity,
  rows: T[],
  locale: string
): Promise<T[]> => {
  if (locale === DEFAULT_LOCALE || rows.length === 0) return rows;

  const translations = await prisma.contentTranslation.findMany({
    where: { entity, locale, entity_id: { in: rows.map((row) => row.id) } },
    select: { entity_id: true, field: true, value: true },
  });
  if (translations.length === 0) return rows;

  const byId = new Map<number, Record<string, string>>();
  for (const t of translations) {
    byId.set(t.entity_id, { ...byId.get(t.entity_id), [t.field]: t.value });
  }
  return rows.map((row) => ({ ...row, ...byId.get(row.id) }));
};

export const translateOne = async <T extends { id: number }>(
  entity: TranslatableEntity,
  row: T,
  locale: string
): Promise<T> => (await translate(entity, [row], locale))[0];

// Ids of entities whose translated text matches the search term (used by F32 search).
export const searchTranslatedIds = async (entity: TranslatableEntity, locale: string, q: string) => {
  if (locale === DEFAULT_LOCALE) return [];
  const rows = await prisma.contentTranslation.findMany({
    where: { entity, locale, value: { contains: q } },
    select: { entity_id: true },
    distinct: ["entity_id"],
  });
  return rows.map((row) => row.entity_id);
};

// Translates services and their nested category (when included) in one pass.
export const translateServices = async <T extends { id: number; category?: { id: number } | null }>(
  services: T[],
  locale: string
): Promise<T[]> => {
  const translated = await translate("CityService", services, locale);
  const categories = new Map<number, { id: number }>();
  for (const service of translated) {
    if (service.category) categories.set(service.category.id, service.category);
  }
  const byId = new Map(
    (await translate("ServiceCategory", [...categories.values()], locale)).map((c) => [c.id, c])
  );
  return translated.map((service) =>
    service.category ? { ...service, category: byId.get(service.category.id) ?? service.category } : service
  );
};
