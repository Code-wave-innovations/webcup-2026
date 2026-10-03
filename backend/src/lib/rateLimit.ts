import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors";

// Undefined when the IP cannot be known, e.g. on cPanel/Passenger where the app is reached
// through a Unix socket and TRUST_PROXY is not set. Per-IP limits are then skipped rather
// than applied to every visitor at once.
export const clientIp = (req: Request): string | undefined => req.ip || req.socket.remoteAddress || undefined;

// In-memory fixed-window limiter, per process. Enough for a single instance;
// use a shared store (Redis) if the API is ever scaled horizontally.
export const rateLimit = ({
  windowMs,
  max,
  key = clientIp,
}: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string | undefined;
}) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    const id = key(req);
    if (!id) {
      next();
      return;
    }
    const entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      throw new HttpError(429, "RATE_LIMITED", "Too many requests, please try again later", {
        retry_after_seconds: retryAfter,
      });
    }
    next();
  };
};
