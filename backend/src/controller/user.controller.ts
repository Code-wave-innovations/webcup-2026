import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import userModel from "../model/user.model";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { audit, diff } from "../lib/audit";
import { lockState, lockedEmails, recordAttempt } from "../lib/loginGuard";
import { notifyUser } from "../lib/notify";
import { deviceList, passkeyList } from "./meSecurity.controller";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zId, zLocale } from "../lib/validation";
import { registerSchema, zEmail, zPassword } from "./auth.controller";

// D08 / D09 user administration.
// ADMIN: every account. AGENT (F34): citizen accounts only, and never their credentials
// (email, password) or role, so an agent cannot take over a citizen's space.

const listQuerySchema = paginationSchema.extend({
  role: z.nativeEnum(Role).optional(),
  q: z.string().trim().min(1).optional(),
  is_active: zBool.optional(),
  district_id: zId.optional(),
});

const createSchema = registerSchema.extend({
  role: z.nativeEnum(Role).default("CITIZEN"),
});

const profileFields = {
  name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(191).nullable().optional(),
  district_id: zId.nullable().optional(),
  locale: zLocale.optional(),
  is_active: zBool.optional(),
  is_vulnerable: zBool.optional(),
};

const agentUpdateSchema = z.object(profileFields);

const adminUpdateSchema = z.object({
  ...profileFields,
  email: zEmail.optional(),
  password: zPassword.optional(),
  role: z.nativeEnum(Role).optional(),
});

const isAdmin = (req: Request) => req.user!.role === "ADMIN";

// F34: deactivating an account must say why (kept in the audit log)
const zReason = z.string().trim().min(3).max(500);

const AUDITED_FIELDS = ["name", "last_name", "email", "phone", "address", "district_id", "locale", "is_vulnerable"] as const;

const fullName = (user: { name: string; last_name: string }) => `${user.name} ${user.last_name}`;

type Listed = { email: string };
// F37 / F34: the lock state the staff screens need next to each account
export const withLock = async <T extends Listed>(user: T) => ({ ...user, ...(await lockState(user.email)) });

// Agents only see citizens; anything else is reported as not found.
const loadManageable = async (req: Request) => {
  const user = await userModel.getById(parseId(req.params.id));
  if (!user || (!isAdmin(req) && user.role !== "CITIZEN")) throw notFound("User not found");
  return user;
};

const userController = {
  getAll: async (req: Request, res: Response) => {
    const { role, q, is_active, district_id, ...pagination } = listQuerySchema.parse(req.query);
    const where: Prisma.UserWhereInput = {
      role: isAdmin(req) ? role : "CITIZEN",
      is_active,
      district_id,
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }, { last_name: { contains: q } }] } : {}),
    };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await userModel.list(where, skip, take);
    res.json({ data: await Promise.all(data.map(withLock)), meta: pageMeta(pagination, total) });
  },

  // Who a request can be assigned to (F22, BO-01): every active agent and admin, for all staff
  staff: async (_req: Request, res: Response) => {
    res.json(
      await prisma.user.findMany({
        where: { role: { in: ["AGENT", "ADMIN"] }, is_active: true },
        select: { id: true, name: true, last_name: true, email: true, role: true },
        orderBy: [{ name: "asc" }, { last_name: "asc" }],
      })
    );
  },

  // D08: accounts per role, for the tabs of the users page and the roles matrix (admin)
  stats: async (_req: Request, res: Response) => {
    const [byRole, active, inactive, locked] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.count({ where: { is_active: true } }),
      prisma.user.count({ where: { is_active: false } }),
      lockedEmails(),
    ]);
    const lockedAccounts = await prisma.user.count({ where: { email: { in: locked.map((row) => row.email) } } });
    res.json({
      by_role: Object.fromEntries(byRole.map((row) => [row.role, row._count._all])),
      active,
      inactive,
      locked: lockedAccounts,
    });
  },

  getOne: async (req: Request, res: Response) => {
    res.json(await withLock(await loadManageable(req)));
  },

  // Admin only (see router): creates any kind of account, including staff.
  create: async (req: Request, res: Response) => {
    const { password, ...input } = createSchema.parse(req.body);
    const user = await userModel.create({ ...input, password_hash: await hashPassword(password) });
    await audit(req, {
      action: "user.created",
      entity: "User",
      entityId: user.id,
      label: fullName(user),
      changes: [{ field: "role", from: null, to: user.role }, { field: "email", from: null, to: user.email }],
    });
    res.status(201).json(user);
  },

  update: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    if (!isAdmin(req)) {
      const forbiddenKeys = ["email", "password", "role"].filter((key) => key in (req.body ?? {}));
      if (forbiddenKeys.length) throw forbidden(`Agents cannot change ${forbiddenKeys.join(", ")}`);
    }
    const { reason, ...body } = (req.body ?? {}) as Record<string, unknown>;
    const { password, ...input } = (isAdmin(req) ? adminUpdateSchema : agentUpdateSchema).parse(body) as z.infer<
      typeof adminUpdateSchema
    >;
    // Prevent an admin from locking themselves out.
    if (target.id === req.user!.id && ((input.role && input.role !== "ADMIN") || input.is_active === false)) {
      throw badRequest("You cannot remove your own admin access");
    }
    const deactivating = input.is_active === false && target.is_active;
    const why = deactivating ? z.object({ reason: zReason }).parse({ reason }).reason : undefined;

    const user = await userModel.update(target.id, {
      ...input,
      ...(password ? { password_hash: await hashPassword(password) } : {}),
    });

    // F47 / F48: role and activation have their own action, the profile is one "updated" entry
    const subject = { entity: "User", entityId: user.id, label: fullName(user) };
    if (input.role && input.role !== target.role) {
      await audit(req, { ...subject, action: "user.role_changed", before: target, after: user, fields: ["role"] });
    }
    if (input.is_active !== undefined && input.is_active !== target.is_active) {
      await audit(req, {
        ...subject,
        action: input.is_active ? "user.reactivated" : "user.deactivated",
        before: target,
        after: user,
        fields: ["is_active"],
        metadata: why ? { reason: why } : undefined,
      });
    }
    const profile = diff(target, user, AUDITED_FIELDS);
    if (profile.length || password) {
      await audit(req, {
        ...subject,
        action: "user.updated",
        changes: [...profile, ...(password ? [{ field: "password", masked: true as const }] : [])],
      });
    }
    res.json(await withLock(user));
  },

  // F37: lift a login lock (e.g. after the citizen called the city)
  unlockLogin: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    await recordAttempt({
      email: target.email,
      ip: `staff:${req.user!.id}`,
      success: true,
      reason: "UNLOCKED_BY_STAFF",
      userId: target.id,
    });
    await audit(req, { action: "user.login_unlocked", entity: "User", entityId: target.id, label: fullName(target) });
    res.json({ unlocked: true });
  },

  // BO-05 (admin): the sign-in security of an account, for the « Sécurité » tab of its drawer
  security: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    const [lock, passkeys, devices] = await Promise.all([lockState(target.email), passkeyList(target.id), deviceList(target.id)]);
    res.json({
      ...lock,
      two_factor_enabled_at: target.two_factor_enabled_at,
      passkeys,
      devices: devices.map(({ device_hash: _hash, ...device }) => device),
    });
  },

  devices: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    res.json((await deviceList(target.id)).map(({ device_hash: _hash, ...device }) => device));
  },

  // Signs the account out of every device (stolen laptop, departure)
  revokeSessions: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    await prisma.user.update({ where: { id: target.id }, data: { token_version: { increment: 1 } } });
    await audit(req, { action: "security.sessions_revoked", entity: "User", entityId: target.id, label: fullName(target), metadata: { by: "admin" } });
    res.json({ revoked: true });
  },

  // F53: a lost phone; the person is told and sets the second factor up again at the next sign-in
  resetTwoFactor: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { two_factor_secret: null, two_factor_enabled_at: null } }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { user_id: target.id } }),
    ]);
    await notifyUser(target.id, {
      type: "SECURITY",
      title: "Double vérification réinitialisée",
      body: "Un administrateur a réinitialisé la double vérification de votre compte. Activez-la de nouveau depuis « Mon compte ».",
      link: "/compte",
    });
    await audit(req, { action: "security.2fa_reset", entity: "User", entityId: target.id, label: fullName(target) });
    res.json({ reset: true });
  },

  // D02: removes every passkey of the account
  revokePasskeys: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    const { count } = await prisma.passkey.deleteMany({ where: { user_id: target.id } });
    await audit(req, { action: "security.passkey_revoked", entity: "User", entityId: target.id, label: fullName(target), metadata: { count, by: "admin" } });
    res.json({ revoked: count });
  },

  delete: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    if (target.id === req.user!.id) throw badRequest("You cannot delete your own account");
    const deleted = await userModel.delete(target.id);
    await audit(req, {
      action: "user.deleted",
      entity: "User",
      entityId: target.id,
      label: fullName(target),
      metadata: { role: target.role },
    });
    res.json(deleted);
  },
};

export default userController;
