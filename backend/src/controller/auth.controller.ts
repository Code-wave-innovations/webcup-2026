import type { Request, Response } from "express";
import { z } from "zod";
import userModel from "../model/user.model";
import { forbidden, unauthorized } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { zBool, zId, zLocale } from "../lib/validation";
import { generateToken } from "../services/services";

export const zEmail = z.string().trim().toLowerCase().email().max(191);
export const zPassword = z.string().min(8, "Password must contain at least 8 characters").max(128);

// D01: self-registration always creates a CITIZEN; staff accounts are created by an admin.
export const registerSchema = z.object({
  email: zEmail,
  password: zPassword,
  name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(191).optional(),
  district_id: zId.optional(),
  locale: zLocale.optional(),
  is_vulnerable: zBool.optional(),
});

const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1),
});

const authController = {
  register: async (req: Request, res: Response) => {
    const { password, ...input } = registerSchema.parse(req.body);
    const user = await userModel.create({
      ...input,
      password_hash: await hashPassword(password),
      role: "CITIZEN",
    });
    res.status(201).json({ token: generateToken(user.id, user.email, user.role), user });
  },

  // D03
  login: async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    const account = await userModel.getByEmailWithPassword(email);
    const valid = await verifyPassword(password, account?.password_hash);
    if (!account || !valid) throw unauthorized("Invalid email or password");
    if (!account.is_active) throw forbidden("This account has been disabled");

    const user = await userModel.update(account.id, { last_login_at: new Date() });
    res.json({ token: generateToken(user.id, user.email, user.role), user });
  },
};

export default authController;
