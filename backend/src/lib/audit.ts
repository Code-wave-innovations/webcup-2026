import type { Request } from "express";
import { Prisma, type Role } from "@prisma/client";
import prisma from "./prisma";
import { clientIp } from "./rateLimit";

// Never copy a credential into the journal, whichever caller lists the field.
const SECRET_FIELDS = new Set([
  "password",
  "password_hash",
  "current_password",
  "new_password",
  "token",
  "secret",
  "totp_secret",
  "two_factor_secret",
]);

// Coordinates of a resident. A service's public address is not in this set:
// masking is decided per call (User rows mask phone and address).
const DEFAULT_MASKED_BY_ENTITY: Record<string, readonly string[]> = {
  User: ["phone", "address"],
};

const MAX_TEXT = 160;

export type AuditChange = {
  field: string;
  from?: string | null;
  to?: string | null;
  masked?: true;
};

export type AuditActor = {
  id?: number | null;
  role?: Role | null;
  name?: string | null;
};

type JsonRecord = Record<string, unknown>;

export type AuditInput = {
  action: string;
  entity: string;
  entityId?: number | null;
  label?: string | null;
  before?: JsonRecord | null;
  after?: JsonRecord | null;
  /** Compared when `changes` is omitted. */
  fields?: readonly string[];
  changes?: AuditChange[];
  /** Extra fields to store as `{ field, masked: true }` with no value. */
  mask?: readonly string[];
  metadata?: JsonRecord | null;
  /**
   * Replaces the signed-in user. Pass `null` for the scheduler.
   * Omit it to read the actor from `req.user`.
   */
  actor?: AuditActor | null;
  /** Keep the row even when nothing in `fields` changed (unlock, delete, export). */
  always?: boolean;
  /** Default true. False for a citizen erasing their account (no IP kept). */
  includeIp?: boolean;
};

export const personName = (user: { name?: string | null; last_name?: string | null } | null | undefined) => {
  const name = [user?.name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || null;
};

const clip = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);

export const previewText = (value: string, max = 120) => (value.length <= max ? value : `${value.slice(0, max)}…`);

const asText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return clip(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return clip(JSON.stringify(value));
  } catch {
    return clip(String(value));
  }
};

/** Differences limited to `fields`. Secrets are dropped. Masked fields keep no value. */
export const diffChanges = (
  before: JsonRecord | null | undefined,
  after: JsonRecord | null | undefined,
  fields: readonly string[],
  mask: ReadonlySet<string> = new Set()
): AuditChange[] => {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    if (SECRET_FIELDS.has(field)) continue;
    const from = asText(before ? before[field] : null);
    const to = asText(after ? after[field] : null);
    if (from === to) continue;
    if (mask.has(field)) {
      changes.push({ field, masked: true });
      continue;
    }
    changes.push({ field, from, to });
  }
  return changes;
};

/**
 * F47 / F48: append one journal row. A failure here is logged and swallowed so
 * the business action the caller already performed still succeeds.
 */
export async function audit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    const mask = new Set(input.mask ?? DEFAULT_MASKED_BY_ENTITY[input.entity] ?? []);
    const raw = input.changes ?? (input.fields ? diffChanges(input.before, input.after, input.fields, mask) : []);
    const changes = raw
      .filter((change) => !SECRET_FIELDS.has(change.field))
      .map((change) => (mask.has(change.field) ? { field: change.field, masked: true as const } : change));
    if (!input.always && changes.length === 0 && !input.metadata) return;

    let actorId: number | null = null;
    let actorRole: Role | null = null;
    let actorName: string | null = null;

    if (input.actor !== undefined) {
      actorId = input.actor?.id ?? null;
      actorRole = input.actor?.role ?? null;
      actorName = input.actor?.name ?? null;
    } else if (req?.user) {
      actorId = req.user.id;
      actorRole = req.user.role;
      const row = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true, last_name: true },
      });
      actorName = personName(row);
    }

    const ip = input.includeIp === false || !req ? undefined : clientIp(req)?.slice(0, 64);

    await prisma.auditLog.create({
      data: {
        actor_id: actorId,
        actor_role: actorRole,
        actor_name: actorName,
        action: input.action.slice(0, 64),
        entity: input.entity.slice(0, 64),
        entity_id: input.entityId ?? null,
        entity_label: input.label ? input.label.slice(0, 191) : null,
        changes: changes.length ? (changes as unknown as Prisma.InputJsonValue) : undefined,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        ip,
      },
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
