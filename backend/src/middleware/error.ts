import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors";

const send = (res: Response, status: number, code: string, message: string, details?: unknown) => {
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
};

export const notFoundHandler = (req: Request, res: Response) => {
  send(res, 404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} not found`);
};

// Must keep 4 parameters so Express recognizes it as an error handler.
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    send(res, 400, "VALIDATION_ERROR", "Invalid input", err.flatten());
    return;
  }
  if (err instanceof HttpError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      send(res, 409, "CONFLICT", "A record with this value already exists", { target: err.meta?.target });
      return;
    }
    if (err.code === "P2025") {
      send(res, 404, "NOT_FOUND", "Resource not found");
      return;
    }
    if (err.code === "P2003") {
      send(res, 400, "BAD_REQUEST", "A referenced record does not exist", { field: err.meta?.field_name });
      return;
    }
  }
  if (err instanceof SyntaxError && "body" in err) {
    send(res, 400, "BAD_REQUEST", "Malformed JSON body");
    return;
  }

  console.error(err);
  send(res, 500, "INTERNAL_ERROR", "Internal server error");
};
