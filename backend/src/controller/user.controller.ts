import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";
import userModel from "../model/user.model";
import { badRequest, notFound } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zId, zLocale } from "../lib/validation";
import { registerSchema, zEmail, zPassword } from "./auth.controller";

// D08 / D09: user administration, ADMIN only (see user.router.ts).

const listQuerySchema = paginationSchema.extend({
  role: z.nativeEnum(Role).optional(),
  q: z.string().trim().min(1).optional(),
  is_active: zBool.optional(),
  district_id: zId.optional(),
});

const createSchema = registerSchema.extend({
  role: z.nativeEnum(Role).default("CITIZEN"),
});

const updateSchema = z.object({
  email: zEmail.optional(),
  password: zPassword.optional(),
  name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(191).nullable().optional(),
  district_id: zId.nullable().optional(),
  locale: zLocale.optional(),
  role: z.nativeEnum(Role).optional(),
  is_active: zBool.optional(),
  is_vulnerable: zBool.optional(),
});

const userController = {
  getAll: async (req: Request, res: Response) => {
    const { role, q, is_active, district_id, ...pagination } = listQuerySchema.parse(req.query);
    const where: Prisma.UserWhereInput = {
      role,
      is_active,
      district_id,
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }, { last_name: { contains: q } }] } : {}),
    };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await userModel.list(where, skip, take);
    res.json({ data, meta: pageMeta(pagination, total) });
  },

  getOne: async (req: Request, res: Response) => {
    const user = await userModel.getById(parseId(req.params.id));
    if (!user) throw notFound("User not found");
    res.json(user);
  },

  create: async (req: Request, res: Response) => {
    const { password, ...input } = createSchema.parse(req.body);
    const user = await userModel.create({ ...input, password_hash: await hashPassword(password) });
    res.status(201).json(user);
  },

  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const { password, ...input } = updateSchema.parse(req.body);
    // Prevent an admin from locking themselves out.
    if (id === req.user!.id && ((input.role && input.role !== "ADMIN") || input.is_active === false)) {
      throw badRequest("You cannot remove your own admin access");
    }
    const user = await userModel.update(id, {
      ...input,
      ...(password ? { password_hash: await hashPassword(password) } : {}),
    });
    res.json(user);
  },

  delete: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id === req.user!.id) throw badRequest("You cannot delete your own account");
    res.json(await userModel.delete(id));
  },
};

export default userController;
