import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Prisma.InputJsonValue;
};

// Creates one in-app notification per active user matching `where`. Returns the count.
export const notifyUsers = async (where: Prisma.UserWhereInput, notification: NotificationInput) => {
  const users = await prisma.user.findMany({
    where: { ...where, is_active: true },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((user) => ({ user_id: user.id, ...notification })),
  });
  return users.length;
};

export const notifyUser = (userId: number, notification: NotificationInput) =>
  prisma.notification.create({ data: { user_id: userId, ...notification } });
