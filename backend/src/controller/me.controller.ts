import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import userModel from "../model/user.model";
import { audit, auditAs } from "../lib/audit";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { zBool, zId, zLocale } from "../lib/validation";
import { zPassword } from "./auth.controller";
import { OPEN_STATUSES } from "../model/citizenRequest.model";

export const nextAppointmentOf = (userId: number) =>
  prisma.appointment.findFirst({
    where: { citizen_id: userId, status: "BOOKED", slot: { starts_at: { gte: new Date() } } },
    orderBy: { slot: { starts_at: "asc" } },
    select: {
      id: true,
      reference: true,
      slot: { select: { starts_at: true, ends_at: true, location: true, service: { select: { name: true } } } },
    },
  });

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

// F33: the password is asked again so an unattended session cannot delete the account.
const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal(true, { errorMap: () => ({ message: "Set confirm to true to delete the account" }) }),
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

    const [requestsTotal, requestsOpen, unreadNotifications, nextAppointment] = await Promise.all([
      prisma.citizenRequest.count({ where: { citizen_id: userId } }),
      prisma.citizenRequest.count({ where: { citizen_id: userId, status: { in: OPEN_STATUSES } } }),
      prisma.notification.count({ where: { user_id: userId, read_at: null } }),
      nextAppointmentOf(userId),
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
        next_appointment: nextAppointment,
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
    await audit(req, { action: "security.password_changed", entity: "User", entityId: req.user!.id, label: `${req.user!.name} ${req.user!.last_name}` });
    res.json({ message: "Password updated" });
  },

  // F33: citizens delete their own account. Requests are kept for the city's records but
  // detached from the person; upcoming appointments are cancelled; notifications are deleted.
  deleteAccount: async (req: Request, res: Response) => {
    const { password } = deleteAccountSchema.parse(req.body);
    const user = req.user!;
    if (user.role !== "CITIZEN") throw forbidden("Staff accounts are removed by an administrator");
    const hash = await userModel.getPasswordHash(user.id);
    if (!(await verifyPassword(password, hash))) throw badRequest("Password is incorrect");

    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { citizen_id: user.id, status: "BOOKED" },
        data: { status: "CANCELLED", cancelled_at: new Date() },
      }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
    // F33 / F47: the deletion is traced without any personal data (no name, no IP)
    await auditAs(null, null, { action: "user.self_deleted", entity: "User", entityId: user.id });
    res.json({
      deleted: true,
      message:
        "Votre compte a été supprimé. Vos demandes passées restent archivées par la ville sans être rattachées à votre identité.",
    });
  },

  // D12
  completeOnboarding: async (req: Request, res: Response) => {
    const user = await userModel.update(req.user!.id, { onboarding_completed: true });
    res.json(user);
  },
};

export default meController;
