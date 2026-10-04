import type { Response } from "express";
import { z } from "zod";
import { HttpError } from "./errors";

/** Minimum time (ms) between opening the form and submitting it. */
export const MIN_FORM_MS = 2_000;
/** Ignore forms left open longer than this (clock skew / abandoned tabs). */
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

export const CONTACT_SOFT_IP = { windowMs: 15 * 60 * 1000, max: 2 } as const;
export const CONTACT_HARD_IP = { windowMs: 15 * 60 * 1000, max: 5 } as const;
export const CONTACT_HARD_EMAIL = { windowMs: 60 * 60 * 1000, max: 3 } as const;

export const REGISTER_SOFT_IP = { windowMs: 60 * 60 * 1000, max: 2 } as const;
export const REGISTER_HARD_EMAIL = { windowMs: 60 * 60 * 1000, max: 3 } as const;

export const formGuardFieldsSchema = z.object({
  website: z.string().optional(),
  company: z.string().optional(),
  form_started_at: z.coerce.number().optional(),
  turnstile_token: z.string().max(2048).optional(),
});

export type FormGuardFields = z.infer<typeof formGuardFieldsSchema>;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const prune = (now: number) => {
  if (buckets.size <= 10_000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
};

const peek = (key: string, windowMs: number, now = Date.now()): { count: number; resetAt: number } => {
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) return { count: 0, resetAt: now + windowMs };
  return entry;
};

const hit = (key: string, windowMs: number, now = Date.now()): number => {
  prune(now);
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
};

const botRejected = () =>
  new HttpError(400, "BOT_REJECTED", "Soumission refusée. Rechargez la page et réessayez.");

/** Honeypot + minimum form fill time. Call before creating any row. */
export const assertHumanForm = (fields: FormGuardFields): void => {
  const honeypot = (fields.website ?? fields.company ?? "").trim();
  if (honeypot) throw botRejected();

  const started = fields.form_started_at;
  if (started == null || !Number.isFinite(started)) throw botRejected();

  const now = Date.now();
  const age = now - started;
  if (age < MIN_FORM_MS || age > MAX_FORM_AGE_MS || started > now + 5_000) throw botRejected();
};

export const softExceeded = (key: string, windowMs: number, max: number): boolean =>
  peek(key, windowMs).count >= max;

export const assertHardLimit = (
  res: Response,
  key: string,
  windowMs: number,
  max: number,
  message: string
): void => {
  const now = Date.now();
  const { count, resetAt } = peek(key, windowMs, now);
  if (count < max) return;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  res.set("Retry-After", String(retryAfter));
  throw new HttpError(429, "RATE_LIMITED", message, { retry_after_seconds: retryAfter });
};

export const recordFormSuccess = (key: string, windowMs: number): void => {
  hit(key, windowMs);
};

export const contactIpKey = (ip: string) => `contact:ip:${ip}`;
export const contactEmailKey = (email: string) => `contact:email:${email.toLowerCase()}`;
export const registerIpKey = (ip: string) => `register:ip:${ip}`;
export const registerEmailKey = (email: string) => `register:email:${email.toLowerCase()}`;

/** Soft threshold or unknown IP → Turnstile when the secret is configured. */
export const isFormSuspect = (opts: {
  ip: string | undefined;
  softKey: string | undefined;
  softWindowMs: number;
  softMax: number;
}): boolean => {
  if (!opts.ip) return true;
  if (!opts.softKey) return false;
  return softExceeded(opts.softKey, opts.softWindowMs, opts.softMax);
};

/** Test helper: clear in-memory buckets between tests. */
export const __resetFormGuardForTests = () => buckets.clear();
