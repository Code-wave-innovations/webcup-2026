import type { Request, Response } from "express";
import { AlertAudience, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { notFound } from "../lib/errors";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zId } from "../lib/validation";
import { audienceUserWhere } from "../model/alert.model";

// F30 / D18 / D11: the current user's in-app notifications

const listQuerySchema = paginationSchema.extend({ unread: zBool.optional() });

// "1,4" or repeated ?district_ids=1&district_ids=4
const audienceQuerySchema = z.object({
  audience: z.nativeEnum(AlertAudience).default("ALL"),
  district_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (value === undefined ? [] : [value].flat().flatMap((part) => part.split(",")).filter(Boolean)))
    .pipe(z.array(zId)),
});

const findOwn = async (req: Request) => {
  const id = parseId(req.params.id);
  const notification = await prisma.notification.findFirst({ where: { id, user_id: req.user!.id } });
  if (!notification) throw notFound("Notification not found");
  return notification;
};

const notificationController = {
  // D18 / F29 / F31: how many people a broadcast would reach, counted like notifyUsers sends
  audience: async (req: Request, res: Response) => {
    const { audience, district_ids } = audienceQuerySchema.parse(req.query);
    const count = await prisma.user.count({ where: { ...audienceUserWhere(audience, district_ids), is_active: true } });
    res.json({ audience, district_ids, count });
  },

  getAll: async (req: Request, res: Response) => {
    const { unread, ...pagination } = listQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const where: Prisma.NotificationWhereInput = { user_id: userId, ...(unread ? { read_at: null } : {}) };
    const { skip, take } = toSkipTake(pagination);
    const [data, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { created_at: "desc" }, skip, take }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);
    res.json({ data, meta: { ...pageMeta(pagination, total), unread: unreadCount } });
  },

  unreadCount: async (req: Request, res: Response) => {
    res.json({ unread: await prisma.notification.count({ where: { user_id: req.user!.id, read_at: null } }) });
  },

  markRead: async (req: Request, res: Response) => {
    const notification = await findOwn(req);
    res.json(
      notification.read_at
        ? notification
        : await prisma.notification.update({ where: { id: notification.id }, data: { read_at: new Date() } })
    );
  },

  markAllRead: async (req: Request, res: Response) => {
    const { count } = await prisma.notification.updateMany({
      where: { user_id: req.user!.id, read_at: null },
      data: { read_at: new Date() },
    });
    res.json({ updated: count });
  },

  delete: async (req: Request, res: Response) => {
    const notification = await findOwn(req);
    res.json(await prisma.notification.delete({ where: { id: notification.id }, select: { id: true } }));
  },
};

export default notificationController;
