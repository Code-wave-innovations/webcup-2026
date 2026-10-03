import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

const districtModel = {
  getAll: () => prisma.district.findMany({ orderBy: { name: "asc" } }),
  getOne: (id: number) => prisma.district.findUnique({ where: { id } }),
  create: (data: Prisma.DistrictCreateInput) => prisma.district.create({ data }),
  update: (id: number, data: Prisma.DistrictUpdateInput) => prisma.district.update({ where: { id }, data }),
  delete: (id: number) => prisma.district.delete({ where: { id } }),
};

export default districtModel;
