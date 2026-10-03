import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

export const announcementInclude = {
  author: { select: { id: true, name: true, last_name: true } },
  service: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.AnnouncementInclude;

// Published, already visible (published_at can be set in the future to schedule) and not expired.
export const visibleAnnouncementWhere = (): Prisma.AnnouncementWhereInput => {
  const now = new Date();
  return {
    status: "PUBLISHED",
    published_at: { lte: now },
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  };
};

export const ANNOUNCEMENT_ORDER: Prisma.AnnouncementOrderByWithRelationInput[] = [
  { is_pinned: "desc" },
  { published_at: "desc" },
  { created_at: "desc" },
];

const announcementModel = {
  list: (where: Prisma.AnnouncementWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.announcement.findMany({ where, orderBy: ANNOUNCEMENT_ORDER, skip, take, include: announcementInclude }),
      prisma.announcement.count({ where }),
    ]),
  getOne: (where: Prisma.AnnouncementWhereInput) =>
    prisma.announcement.findFirst({ where, include: announcementInclude }),
  create: (data: Prisma.AnnouncementUncheckedCreateInput) =>
    prisma.announcement.create({ data, include: announcementInclude }),
  update: (id: number, data: Prisma.AnnouncementUncheckedUpdateInput) =>
    prisma.announcement.update({ where: { id }, data, include: announcementInclude }),
  delete: (id: number) => prisma.announcement.delete({ where: { id }, select: { id: true } }),
};

export default announcementModel;
