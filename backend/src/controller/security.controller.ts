import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { MAX_ACCOUNT_FAILURES, WINDOW_MS, lockedEmails } from "../lib/loginGuard";
import { pageMeta, paginationSchema, toSkipTake, zBool } from "../lib/validation";

// F37 / F100: what the security team and the agents need to see an attack happening.

const newDevicesQuerySchema = z.object({ hours: z.coerce.number().int().min(1).max(24 * 30).default(24) });

const attemptsQuerySchema = paginationSchema.extend({
  email: z.string().trim().min(1).optional(),
  ip: z.string().trim().min(1).optional(),
  success: zBool.optional(),
});

const eventsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  kind: z.enum(["login", "device", "factor", "account"]).optional(),
});

const REFUSED_REASONS = ["LOCKED", "IP_BLOCKED", "DISABLED"] as const;

const KIND_ACTIONS = {
  login: ["user.login_unlocked"],
  device: ["security.new_device", "security.device_forgotten", "security.sessions_revoked"],
  factor: ["security.2fa_enabled", "security.2fa_disabled", "security.2fa_reset", "security.passkey_added", "security.passkey_revoked", "security.recovery_code_used"],
  account: ["security.password_changed", "security.password_reset", "security.face_enrolled"],
} as const;

const LOGIN_TYPE: Record<(typeof REFUSED_REASONS)[number], string> = {
  LOCKED: "login.locked",
  IP_BLOCKED: "login.ip_blocked",
  DISABLED: "login.disabled",
};

const BY_DETAIL: Record<string, string> = {
  admin: "par un administrateur",
  self: "par la personne",
};

const userPublicSelect = { id: true, email: true, name: true, last_name: true, role: true } as const;

const lockedAccounts = async () => {
  const locked = await lockedEmails();
  const users = await prisma.user.findMany({
    where: { email: { in: locked.map((row) => row.email) } },
    select: userPublicSelect,
  });
  const byEmail = new Map(users.map((user) => [user.email, user]));
  return locked.map((row) => ({ email: row.email, locked_until: row.locked_until, user: byEmail.get(row.email) ?? null }));
};

const eventDetail = (metadata: Prisma.JsonValue | null): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const rec = metadata as Record<string, unknown>;
  if (typeof rec.device === "string") return rec.device;
  if (typeof rec.passkey === "string") return rec.passkey;
  if (typeof rec.by === "string") return BY_DETAIL[rec.by] ?? rec.by;
  return null;
};

const securityController = {
  overview: async (_req: Request, res: Response) => {
    const now = Date.now();
    const lastHour = new Date(now - 60 * 60 * 1000);
    const lastDay = new Date(now - 24 * 60 * 60 * 1000);
    const lockWindow = new Date(now - WINDOW_MS);
    const invalid = { reason: "INVALID_CREDENTIALS" };

    const [failedHour, successHour, failedDay, blockedDay, emailsInWindow, topIps, locked, staffTotal, staffEnabled, citizensEnabled, passkeyUsers] = await Promise.all([
      prisma.loginAttempt.count({ where: { ...invalid, created_at: { gte: lastHour } } }),
      prisma.loginAttempt.count({ where: { reason: "OK", created_at: { gte: lastHour } } }),
      prisma.loginAttempt.count({ where: { ...invalid, created_at: { gte: lastDay } } }),
      prisma.loginAttempt.count({ where: { reason: { in: ["LOCKED", "IP_BLOCKED"] }, created_at: { gte: lastDay } } }),
      prisma.loginAttempt.groupBy({
        by: ["email"],
        where: { ...invalid, created_at: { gte: lockWindow } },
        _count: { _all: true },
      }),
      prisma.loginAttempt.groupBy({
        by: ["ip"],
        where: { ...invalid, created_at: { gte: lastDay } },
        _count: { _all: true },
        orderBy: { _count: { ip: "desc" } },
        take: 10,
      }),
      lockedAccounts(),
      prisma.user.count({ where: { role: { in: ["AGENT", "ADMIN"] }, is_active: true } }),
      prisma.user.count({ where: { role: { in: ["AGENT", "ADMIN"] }, is_active: true, two_factor_enabled_at: { not: null } } }),
      prisma.user.count({ where: { role: "CITIZEN", two_factor_enabled_at: { not: null } } }),
      prisma.user.count({ where: { passkeys: { some: {} } } }),
    ]);

    res.json({
      last_hour: { failed: failedHour, succeeded: successHour },
      last_24h: { failed: failedDay, blocked: blockedDay },
      // Emails at or over the lock threshold in the current window (approximate: ignores unlocks)
      targeted_accounts: emailsInWindow
        .filter((row) => row._count._all >= MAX_ACCOUNT_FAILURES)
        .map((row) => ({ email: row.email, failures: row._count._all })),
      top_ips: topIps.map((row) => ({ ip: row.ip, failures: row._count._all })),
      // F37: accounts locked right now, with the user to unlock when the e-mail has an account
      locked_accounts: locked,
      // F53 / D02: adoption of the second factor
      two_factor: { staff_enabled: staffEnabled, staff_total: staffTotal, citizens_enabled: citizensEnabled, passkey_users: passkeyUsers },
    });
  },

  // F100: a readable security feed for every staff member (agents never get an IP)
  events: async (req: Request, res: Response) => {
    const { days, limit, kind } = eventsQuerySchema.parse(req.query);
    const now = Date.now();
    const since = new Date(now - days * 86_400_000);
    const lastDay = new Date(now - 86_400_000);
    const lastWeek = new Date(now - 7 * 86_400_000);
    const admin = req.user!.role === "ADMIN";
    const includeRefused = !kind || kind === "login";
    const auditWhere: Prisma.AuditLogWhereInput = {
      created_at: { gte: since },
      ...(kind ? { action: { in: [...KIND_ACTIONS[kind]] } } : { OR: [{ action: { startsWith: "security." } }, { action: "user.login_unlocked" }] }),
    };

    const [audits, refused, refused24h, locked, newDevices24h, factorChanges7d] = await Promise.all([
      prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { created_at: "desc" },
        take: limit,
        select: { id: true, action: true, created_at: true, actor_name: true, entity_id: true, entity_label: true, metadata: true, ip: true },
      }),
      includeRefused
        ? prisma.loginAttempt.groupBy({
            by: ["email", "reason"],
            where: { reason: { in: [...REFUSED_REASONS] }, created_at: { gte: since } },
            _count: { _all: true },
            _max: { created_at: true },
            orderBy: { _max: { created_at: "desc" } },
            take: limit,
          })
        : Promise.resolve([]),
      prisma.loginAttempt.count({ where: { reason: { in: [...REFUSED_REASONS] }, created_at: { gte: lastDay } } }),
      lockedAccounts(),
      prisma.auditLog.count({ where: { action: "security.new_device", created_at: { gte: lastDay } } }),
      prisma.auditLog.count({ where: { action: { in: [...KIND_ACTIONS.factor] }, created_at: { gte: lastWeek } } }),
    ]);

    const refusedUsers = await prisma.user.findMany({
      where: { email: { in: refused.map((row) => row.email) } },
      select: { id: true, name: true, last_name: true, email: true },
    });
    const usersByEmail = new Map(refusedUsers.map((user) => [user.email, user]));

    const auditEvents = audits.map((row) => {
      const event = {
        id: `audit-${row.id}`,
        type: row.action,
        at: row.created_at.toISOString(),
        count: 1,
        account: { id: row.entity_id, label: row.entity_label, email: null as string | null },
        actor_name: row.actor_name,
        detail: eventDetail(row.metadata),
      };
      return admin ? { ...event, ip: row.ip ?? null } : event;
    });

    const refusedEvents = refused.map((row) => {
      const user = usersByEmail.get(row.email);
      const reason = row.reason as (typeof REFUSED_REASONS)[number];
      return {
        id: `login-${row.email}-${row.reason}`,
        type: LOGIN_TYPE[reason] ?? `login.${row.reason.toLowerCase()}`,
        at: (row._max.created_at ?? since).toISOString(),
        count: row._count._all,
        account: { id: user?.id ?? null, label: user ? `${user.name} ${user.last_name}` : null, email: row.email },
        actor_name: null,
        detail: null as string | null,
      };
    });

    const data = [...auditEvents, ...refusedEvents].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);

    res.json({
      summary: {
        refused_24h: refused24h,
        locked_now: locked.length,
        new_devices_24h: newDevices24h,
        factor_changes_7d: factorChanges7d,
      },
      locked_accounts: locked,
      data,
    });
  },

  // Deployment check: shows which client IP the API sees. If "ip" is null or always the same
  // address while x-forwarded-for holds the visitor's IP, set TRUST_PROXY=1.
  clientIp: (req: Request, res: Response) => {
    res.json({
      ip: req.ip ?? null,
      socket_address: req.socket.remoteAddress ?? null,
      x_forwarded_for: req.get("x-forwarded-for") ?? null,
      trust_proxy: req.app.get("trust proxy") ?? false,
    });
  },

  // F54: devices seen for the first time lately, on accounts that already had one
  newDevices: async (req: Request, res: Response) => {
    const { hours } = newDevicesQuerySchema.parse(req.query);
    const since = new Date(Date.now() - hours * 3_600_000);
    const devices = await prisma.userDevice.findMany({
      where: { first_seen: { gte: since } },
      orderBy: { first_seen: "desc" },
      take: 100,
      select: {
        id: true,
        label: true,
        first_seen: true,
        last_ip: true,
        user: { select: { id: true, name: true, last_name: true, email: true, role: true, _count: { select: { devices: true } } } },
      },
    });
    // the first device of an account is not "new": it is how the account started
    const firsts = await prisma.userDevice.groupBy({
      by: ["user_id"],
      where: { user_id: { in: devices.map((d) => d.user.id) } },
      _min: { first_seen: true },
    });
    const firstSeen = new Map(firsts.map((row) => [row.user_id, row._min.first_seen?.getTime()]));
    res.json(
      devices
        .filter((device) => device.first_seen.getTime() > (firstSeen.get(device.user.id) ?? Infinity))
        .map(({ user: { _count, ...user }, ...device }) => ({ ...device, user }))
    );
  },

  attempts: async (req: Request, res: Response) => {
    const { email, ip, success, ...pagination } = attemptsQuerySchema.parse(req.query);
    const where: Prisma.LoginAttemptWhereInput = { email, ip, success };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.loginAttempt.findMany({ where, orderBy: { created_at: "desc" }, skip, take }),
      prisma.loginAttempt.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(pagination, total) });
  },
};

export default securityController;
