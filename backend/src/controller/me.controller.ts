import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import userModel from "../model/user.model";
import { badRequest, notFound } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { zBool, zId, zLocale } from "../lib/validation";
import { zPassword } from "./auth.controller";
import { OPEN_STATUSES } from "../model/citizenRequest.model";

// D12: fields a newcomer is asked to fill in during onboarding.
const PROFILE_FIELDS = ["phone", "address", "district_id"] as const;

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(191).nullable().optional(),
  district_id: zId.nullable().optional(),
  locale: zLocale.optional(),
  is_vulnerable: zBool.optional(),
  // F21/F23/F24 accessibility and display preferences, stored as-is
  preferences: z.record(z.unknown()).nullable().optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: zPassword,
});

const meController = {
  // D03: personal space
  get: async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await userModel.getById(userId);
    if (!user) throw notFound();

    const [requestsTotal, requestsOpen, unreadNotifications] = await Promise.all([
      prisma.citizenRequest.count({ where: { citizen_id: userId } }),
      prisma.citizenRequest.count({ where: { citizen_id: userId, status: { in: OPEN_STATUSES } } }),
      prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);

    const missing = PROFILE_FIELDS.filter((field) => user[field] === null || user[field] === "");
    res.json({
      ...user,
      profile_completion: {
        completed: missing.length === 0,
        missing,
        percent: Math.round((100 * (PROFILE_FIELDS.length - missing.length)) / PROFILE_FIELDS.length),
      },
      summary: {
        requests_total: requestsTotal,
        requests_open: requestsOpen,
        unread_notifications: unreadNotifications,
      },
    });
  },

  update: async (req: Request, res: Response) => {
    const { preferences, ...input } = updateProfileSchema.parse(req.body);
    const user = await userModel.update(req.user!.id, {
      ...input,
      ...(preferences !== undefined
        ? { preferences: preferences === null ? Prisma.DbNull : (preferences as Prisma.InputJsonObject) }
        : {}),
    });
    res.json(user);
  },

  changePassword: async (req: Request, res: Response) => {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);
    const hash = await userModel.getPasswordHash(req.user!.id);
    if (!(await verifyPassword(current_password, hash))) throw badRequest("Current password is incorrect");
    await userModel.update(req.user!.id, { password_hash: await hashPassword(new_password) });
    res.json({ message: "Password updated" });
  },

  // D12
  completeOnboarding: async (req: Request, res: Response) => {
    const user = await userModel.update(req.user!.id, { onboarding_completed: true });
    res.json(user);
  },
};

export default meController;
