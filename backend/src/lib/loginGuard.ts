import prisma from "./prisma";

// F37: brute-force protection backed by the LoginAttempt table.
// - an email is locked after MAX_ACCOUNT_FAILURES bad passwords within WINDOW_MS
//   (counted since its last successful login or staff unlock);
// - an IP is blocked after MAX_IP_FAILURES bad passwords within WINDOW_MS.
// Locks are computed per email whether or not the account exists, so responses
// do not reveal which emails are registered.

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_ACCOUNT_FAILURES = 5;
export const MAX_IP_FAILURES = 20;

export type AttemptReason =
  | "OK"
  | "INVALID_CREDENTIALS"
  | "LOCKED"
  | "IP_BLOCKED"
  | "DISABLED"
  | "UNLOCKED_BY_STAFF"
  | "PASSKEY";

type GuardResult =
  | { allowed: true; failures: number }
  | { allowed: false; code: "ACCOUNT_LOCKED" | "IP_BLOCKED"; retryAfterSeconds: number };

// Successful login or staff unlock; with onlyLogins, real logins only.
const lastResetAt = async (email: string, onlyLogins = false) =>
  (
    await prisma.loginAttempt.findFirst({
      where: { email, success: true, ...(onlyLogins ? { reason: "OK" } : {}) },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    })
  )?.created_at ?? null;

const retryAfter = (from: Date) => Math.max(1, Math.ceil((from.getTime() + WINDOW_MS - Date.now()) / 1000));

// Stored when the client IP is unknown; never used for IP blocking.
export const UNKNOWN_IP = "unknown";

export const checkLoginAllowed = async (email: string, ip: string): Promise<GuardResult> => {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const ipFailures =
    ip === UNKNOWN_IP
      ? []
      : await prisma.loginAttempt.findMany({
          where: { ip, reason: "INVALID_CREDENTIALS", created_at: { gte: windowStart } },
          orderBy: { created_at: "asc" },
          select: { created_at: true },
          take: MAX_IP_FAILURES,
        });
  if (ipFailures.length >= MAX_IP_FAILURES) {
    return { allowed: false, code: "IP_BLOCKED", retryAfterSeconds: retryAfter(ipFailures[0].created_at) };
  }

  const reset = await lastResetAt(email);
  const from = reset && reset > windowStart ? reset : windowStart;
  const failures = await prisma.loginAttempt.findMany({
    where: { email, reason: "INVALID_CREDENTIALS", created_at: { gt: from } },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
    take: MAX_ACCOUNT_FAILURES,
  });
  if (failures.length >= MAX_ACCOUNT_FAILURES) {
    return { allowed: false, code: "ACCOUNT_LOCKED", retryAfterSeconds: retryAfter(failures[0].created_at) };
  }
  return { allowed: true, failures: failures.length };
};

// Bad passwords since the last successful login, shown to the user after logging in.
export const failuresSinceLastLogin = async (email: string) => {
  const reset = await lastResetAt(email, true);
  return prisma.loginAttempt.count({
    where: { email, reason: "INVALID_CREDENTIALS", ...(reset ? { created_at: { gt: reset } } : {}) },
  });
};

export const recordAttempt = (attempt: {
  email: string;
  ip: string;
  userAgent?: string;
  success: boolean;
  reason: AttemptReason;
  userId?: number | null;
}) =>
  prisma.loginAttempt.create({
    data: {
      email: attempt.email,
      ip: attempt.ip.slice(0, 64),
      user_agent: attempt.userAgent?.slice(0, 255),
      success: attempt.success,
      reason: attempt.reason,
      user_id: attempt.userId ?? null,
    },
  });

// F37 / F34: whether an account is locked right now, for the staff screens (IP blocks aside)
export const lockState = async (email: string) => {
  const guard = await checkLoginAllowed(email, UNKNOWN_IP);
  if (guard.allowed) return { login_locked: false, locked_until: null as string | null };
  return { login_locked: true, locked_until: new Date(Date.now() + guard.retryAfterSeconds * 1000).toISOString() };
};

// Emails locked right now (the candidates are those with enough recent failures)
export const lockedEmails = async () => {
  const candidates = await prisma.loginAttempt.groupBy({
    by: ["email"],
    where: { reason: "INVALID_CREDENTIALS", created_at: { gte: new Date(Date.now() - WINDOW_MS) } },
    _count: { _all: true },
    having: { email: { _count: { gte: MAX_ACCOUNT_FAILURES } } },
  });
  const states = await Promise.all(candidates.map(async (row) => ({ email: row.email, ...(await lockState(row.email)) })));
  return states.filter((state) => state.login_locked);
};
