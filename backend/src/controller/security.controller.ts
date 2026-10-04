import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { MAX_ACCOUNT_FAILURES, WINDOW_MS, lockedEmails } from "../lib/loginGuard";
import { pageMeta, paginationSchema, toSkipTake, zBool } from "../lib/validation";

// F37: what the security team needs to see an attack happening.

const newDevicesQuerySchema = z.object({ hours: z.coerce.number().int().min(1).max(24 * 30).default(24) });

const attemptsQuerySchema = paginationSchema.extend({
  email: z.string().trim().min(1).optional(),
  ip: z.string().trim().min(1).optional(),
  success: zBool.optional(),
});

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
      lockedEmails(),
      prisma.user.count({ where: { role: { in: ["AGENT", "ADMIN"] }, is_active: true } }),
      prisma.user.count({ where: { role: { in: ["AGENT", "ADMIN"] }, is_active: true, two_factor_enabled_at: { not: null } } }),
      prisma.user.count({ where: { role: "CITIZEN", two_factor_enabled_at: { not: null } } }),
      prisma.user.count({ where: { passkeys: { some: {} } } }),
    ]);
    const lockedUsers = await prisma.user.findMany({
      where: { email: { in: locked.map((row) => row.email) } },
      select: { id: true, email: true, name: true, last_name: true, role: true },
    });
    const usersByEmail = new Map(lockedUsers.map((user) => [user.email, user]));

    res.json({
      last_hour: { failed: failedHour, succeeded: successHour },
      last_24h: { failed: failedDay, blocked: blockedDay },
      // Emails at or over the lock threshold in the current window (approximate: ignores unlocks)
      targeted_accounts: emailsInWindow
        .filter((row) => row._count._all >= MAX_ACCOUNT_FAILURES)
        .map((row) => ({ email: row.email, failures: row._count._all })),
      top_ips: topIps.map((row) => ({ ip: row.ip, failures: row._count._all })),
      // F37: accounts locked right now, with the user to unlock when the e-mail has an account
      locked_accounts: locked.map((row) => ({ email: row.email, locked_until: row.locked_until, user: usersByEmail.get(row.email) ?? null })),
      // F53 / D02: adoption of the second factor
      two_factor: { staff_enabled: staffEnabled, staff_total: staffTotal, citizens_enabled: citizensEnabled, passkey_users: passkeyUsers },
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
