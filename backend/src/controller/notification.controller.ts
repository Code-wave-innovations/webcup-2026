import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { notFound } from "../lib/errors";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool } from "../lib/validation";

// F30 / D18 / D11: the current user's in-app notifications

const listQuerySchema = paginationSchema.extend({ unread: zBool.optional() });

const findOwn = async (req: Request) => {
  const id = parseId(req.params.id);
  const notification = await prisma.notification.findFirst({ where: { id, user_id: req.user!.id } });
  if (!notification) throw notFound("Notification not found");
  return notification;
};

const notificationController = {
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
