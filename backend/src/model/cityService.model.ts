import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { interruptionsInclude } from "../lib/availability";

// A function because the interruption filter depends on the current time (F38).
export const serviceListInclude = () =>
  ({
    category: { select: { id: true, slug: true, name: true, icon: true } },
    _count: { select: { procedures: { where: { is_active: true } } } },
    interruptions: interruptionsInclude(),
  }) satisfies Prisma.CityServiceInclude;

// F28: featured first, then the admin-defined priority, then the most viewed.
export const SERVICE_ORDER: Record<string, Prisma.CityServiceOrderByWithRelationInput[]> = {
  default: [{ is_featured: "desc" }, { priority: "desc" }, { view_count: "desc" }, { name: "asc" }],
  popular: [{ view_count: "desc" }, { name: "asc" }],
  name: [{ name: "asc" }],
};

const cityServiceModel = {
  list: (
    where: Prisma.CityServiceWhereInput,
    orderBy: Prisma.CityServiceOrderByWithRelationInput[],
    skip: number,
    take: number
  ) =>
    prisma.$transaction([
      prisma.cityService.findMany({ where, orderBy, skip, take, include: serviceListInclude() }),
      prisma.cityService.count({ where }),
    ]),
  getOne: (where: Prisma.CityServiceWhereInput) =>
    prisma.cityService.findFirst({
      where,
      include: {
        category: { select: { id: true, slug: true, name: true, icon: true } },
        procedures: {
          where: { is_active: true },
          orderBy: { title: "asc" },
          select: { id: true, slug: true, title: true, description: true, estimated_days: true },
        },
        interruptions: interruptionsInclude(),
      },
    }),
  incrementViews: (id: number) =>
    prisma.cityService.update({ where: { id }, data: { view_count: { increment: 1 } }, select: { id: true } }),
  create: (data: Prisma.CityServiceUncheckedCreateInput) => prisma.cityService.create({ data }),
  update: (id: number, data: Prisma.CityServiceUncheckedUpdateInput) =>
    prisma.cityService.update({ where: { id }, data }),
  delete: (id: number) => prisma.cityService.delete({ where: { id } }),
};

export default cityServiceModel;
