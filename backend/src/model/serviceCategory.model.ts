import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { idOrSlugWhere } from "../lib/validation";

const activeServices = { where: { is_active: true } };

const serviceCategoryModel = {
  getAll: () =>
    prisma.serviceCategory.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: activeServices } } },
    }),
  getOne: (idOrSlug: string) =>
    prisma.serviceCategory.findFirst({
      where: idOrSlugWhere(idOrSlug),
      include: {
        services: {
          ...activeServices,
          orderBy: [{ is_featured: "desc" }, { priority: "desc" }, { name: "asc" }],
          select: { id: true, slug: true, name: true, summary: true, icon: true, is_featured: true },
        },
      },
    }),
  create: (data: Prisma.ServiceCategoryCreateInput) => prisma.serviceCategory.create({ data }),
  update: (id: number, data: Prisma.ServiceCategoryUpdateInput) =>
    prisma.serviceCategory.update({ where: { id }, data }),
  delete: (id: number) => prisma.serviceCategory.delete({ where: { id } }),
};

export default serviceCategoryModel;
