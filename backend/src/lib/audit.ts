import type { Request } from "express";
import type { Prisma, Role } from "@prisma/client";
import prisma from "./prisma";
import { clientIp } from "./rateLimit";

// F47 / F48: who did what, when, on which record. Every staff mutation calls audit() after it
// succeeded. Writing the entry never makes the action fail: an error is only logged.

// Never copied into the journal, whatever the caller passes
const SECRET_FIELDS = new Set([
  "password",
  "password_hash",
  "token",
  "token_version",
  "two_factor_secret",
  "code",
  "recovery_code",
  "public_key",
  "secret",
]);
// A citizen's contact details: the journal says they changed, not their value
const MASKED_FIELDS = new Set(["phone", "address"]);

export type AuditChange = { field: string; from: unknown; to: unknown } | { field: string; masked: true };

export interface AuditInput {
  // request.status_changed, user.updated… (see back-office-only-plan/BO-03 § 3.3)
  action: string;
  entity: string;
  entityId?: number | null;
  // what a person reads: NT-261003-4F9A2C, « État civil »…
  label?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  // fields compared between before and after
  fields?: readonly string[];
  // already computed changes (added to the diff)
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
}

const plain = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (typeof value === "object" && value !== null) return JSON.parse(JSON.stringify(value));
  return value;
};

const same = (a: unknown, b: unknown) => JSON.stringify(plain(a)) === JSON.stringify(plain(b));

/** The changes on `fields` between two versions of a record (secrets dropped, personal data masked). */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined, fields: readonly string[]): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    if (SECRET_FIELDS.has(field)) continue;
    const from = before?.[field];
    const to = after?.[field];
    if (after && !(field in after) && before) continue;
    if (same(from, to)) continue;
    changes.push(MASKED_FIELDS.has(field) ? { field, masked: true } : { field, from: plain(from), to: plain(to) });
  }
  return changes;
}

const withoutSecrets = (metadata?: Record<string, unknown>) =>
  metadata && Object.fromEntries(Object.entries(metadata).filter(([key]) => !SECRET_FIELDS.has(key)).map(([key, value]) => [key, plain(value)]));

type Actor = { id: number; role: Role; name: string; last_name: string } | null;

async function write(actor: Actor, ip: string | null, input: AuditInput) {
  try {
    const changes = [...diff(input.before, input.after, input.fields ?? []), ...(input.changes ?? [])];
    const metadata = withoutSecrets(input.metadata);
    await prisma.auditLog.create({
      data: {
        actor_id: actor?.id ?? null,
        actor_role: actor?.role ?? null,
        actor_name: actor ? `${actor.name} ${actor.last_name}` : null,
        action: input.action.slice(0, 64),
        entity: input.entity.slice(0, 64),
        entity_id: input.entityId ?? null,
        entity_label: input.label?.slice(0, 191) ?? null,
        changes: changes.length ? (changes as Prisma.InputJsonArray) : undefined,
        metadata: metadata && Object.keys(metadata).length ? (metadata as Prisma.InputJsonObject) : undefined,
        ip: ip?.slice(0, 64) ?? null,
      },
    });
  } catch (error) {
    console.error("audit: could not record", input.action, error);
  }
}

/** Records an action of the signed-in person (req.user). */
export const audit = (req: Request, input: AuditInput) => write(req.user ?? null, clientIp(req) ?? null, input);

/** Records an action of someone who is not req.user yet (login steps) or of the system (actor null). */
export const auditAs = (actor: Actor, req: Request | null, input: AuditInput) => write(actor, req ? (clientIp(req) ?? null) : null, input);

/** The fields a PATCH body actually sets: what an "updated" entry compares. */
export const fieldsOf = (input: object) => Object.entries(input).filter(([, value]) => value !== undefined).map(([key]) => key);
