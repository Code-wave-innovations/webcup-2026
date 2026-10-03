import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import userModel from "../model/user.model";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { recordAttempt } from "../lib/loginGuard";
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
    res.json({ data, meta: pageMeta(pagination, total) });
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

  getOne: async (req: Request, res: Response) => {
    res.json(await loadManageable(req));
  },

  // Admin only (see router): creates any kind of account, including staff.
  create: async (req: Request, res: Response) => {
    const { password, ...input } = createSchema.parse(req.body);
    const user = await userModel.create({ ...input, password_hash: await hashPassword(password) });
    res.status(201).json(user);
  },

  update: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    if (!isAdmin(req)) {
      const forbiddenKeys = ["email", "password", "role"].filter((key) => key in (req.body ?? {}));
      if (forbiddenKeys.length) throw forbidden(`Agents cannot change ${forbiddenKeys.join(", ")}`);
    }
    const { password, ...input } = (isAdmin(req) ? adminUpdateSchema : agentUpdateSchema).parse(req.body) as z.infer<
      typeof adminUpdateSchema
    >;
    // Prevent an admin from locking themselves out.
    if (target.id === req.user!.id && ((input.role && input.role !== "ADMIN") || input.is_active === false)) {
      throw badRequest("You cannot remove your own admin access");
    }
    const user = await userModel.update(target.id, {
      ...input,
      ...(password ? { password_hash: await hashPassword(password) } : {}),
    });
    res.json(user);
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
    res.json({ unlocked: true });
  },

  delete: async (req: Request, res: Response) => {
    const target = await loadManageable(req);
    if (target.id === req.user!.id) throw badRequest("You cannot delete your own account");
    res.json(await userModel.delete(target.id));
  },
};

export default userController;
