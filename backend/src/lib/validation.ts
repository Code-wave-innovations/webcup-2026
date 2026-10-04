import { z } from "zod";
import { HttpError, badRequest } from "./errors";

// Multipart bodies (express-fileupload) only contain strings, so numeric,
// boolean and JSON fields are coerced to accept both JSON and form-data input.

export const zId = z.coerce.number().int().positive();

export const zBool = z.preprocess((value) => {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean());

export const zJson = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, schema);

export const zDate = z.coerce.date();

export const zLocale = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Expected a locale such as fr, en or mg");

export const zSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected lowercase letters, digits and dashes");

// Any JSON value, for free-form columns (preferences, form answers, recommendations…)
export const zJsonValue: z.ZodType<unknown> = z.unknown();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const toSkipTake = ({ page, limit }: Pagination) => ({ skip: (page - 1) * limit, take: limit });

export const pageMeta = ({ page, limit }: Pagination, total: number) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

// Express 5 types route params as `string | string[]` (wildcards); `:id` is always a string.
export type ParamValue = string | string[] | undefined;

export const paramValue = (value: ParamValue): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") throw badRequest("Invalid id");
  return raw;
};

export const parseId = (value: ParamValue): number => {
  const id = Number(paramValue(value));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  return id;
};

// Routes like /services/:idOrSlug accept a numeric id or a slug.
export const idOrSlugWhere = (value: ParamValue) => {
  const raw = paramValue(value);
  return /^\d+$/.test(raw) ? { id: Number(raw) } : { slug: raw };
};

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

// A 400 shaped like a zod error, so the front shows it next to the field (F42)
export const fieldError = (field: string, message: string) =>
  new HttpError(400, "VALIDATION_ERROR", "Invalid input", { formErrors: [], fieldErrors: { [field]: [message] } });
