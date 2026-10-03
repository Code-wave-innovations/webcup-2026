import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { MAX_ACCOUNT_FAILURES, WINDOW_MS } from "../lib/loginGuard";
import { pageMeta, paginationSchema, toSkipTake, zBool } from "../lib/validation";

// F37: what the security team needs to see an attack happening.

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

    const [failedHour, successHour, failedDay, blockedDay, emailsInWindow, topIps] = await Promise.all([
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
    ]);

    res.json({
      last_hour: { failed: failedHour, succeeded: successHour },
      last_24h: { failed: failedDay, blocked: blockedDay },
      // Emails at or over the lock threshold in the current window (approximate: ignores unlocks)
      targeted_accounts: emailsInWindow
        .filter((row) => row._count._all >= MAX_ACCOUNT_FAILURES)
        .map((row) => ({ email: row.email, failures: row._count._all })),
      top_ips: topIps.map((row) => ({ ip: row.ip, failures: row._count._all })),
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
