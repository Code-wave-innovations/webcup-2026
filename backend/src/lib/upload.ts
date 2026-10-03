import type { Request } from "express";
import { badRequest } from "./errors";
import { uploadFile } from "../services/services";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf"]);

// Saves req.files[field] to ./public/ and returns the stored file name,
// or undefined when no file was sent. Size is capped in index.ts (fileUpload limits).
export const saveUpload = async (req: Request, field: string, prefix: string) => {
  const file = req.files?.[field];
  if (!file) return undefined;
  if (Array.isArray(file)) throw badRequest(`Only one file is allowed for "${field}"`);

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw badRequest(`Unsupported file type for "${field}"`, { allowed: [...ALLOWED_EXTENSIONS] });
  }
  return (await uploadFile("./public/", file, prefix)) as string;
};
