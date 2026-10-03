import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

// Never select password_hash outside of login.
export const publicUserSelect = {
  id: true,
  created_at: true,
  updated_at: true,
  email: true,
  name: true,
  last_name: true,
  phone: true,
  address: true,
  profile: true,
  district_id: true,
  role: true,
  locale: true,
  is_vulnerable: true,
  is_active: true,
  onboarding_completed: true,
  preferences: true,
  last_login_at: true,
  district: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;

const userModel = {
  list: (where: Prisma.UserWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.user.findMany({ where, select: publicUserSelect, orderBy: { id: "desc" }, skip, take }),
      prisma.user.count({ where }),
    ]),
  getById: (id: number) => prisma.user.findUnique({ where: { id }, select: publicUserSelect }),
  existsByEmail: async (email: string) =>
    !!(await prisma.user.findUnique({ where: { email }, select: { id: true } })),
  getByEmailWithPassword: (email: string) => prisma.user.findUnique({ where: { email } }),
  getPasswordHash: async (id: number) =>
    (await prisma.user.findUnique({ where: { id }, select: { password_hash: true } }))?.password_hash,
  create: (data: Prisma.UserUncheckedCreateInput) => prisma.user.create({ data, select: publicUserSelect }),
  update: (id: number, data: Prisma.UserUncheckedUpdateInput) =>
    prisma.user.update({ where: { id }, data, select: publicUserSelect }),
  delete: (id: number) => prisma.user.delete({ where: { id }, select: { id: true } }),
};

export default userModel;
