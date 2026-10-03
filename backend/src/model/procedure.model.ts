import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { interruptionsInclude } from "../lib/availability";

const serviceSelect = { select: { id: true, slug: true, name: true } };

const procedureModel = {
  getAll: (where: Prisma.ProcedureWhereInput) =>
    prisma.procedure.findMany({ where, orderBy: { title: "asc" }, include: { service: serviceSelect } }),
  getOne: (where: Prisma.ProcedureWhereInput) =>
    prisma.procedure.findFirst({
      where,
      include: { service: { select: { ...serviceSelect.select, interruptions: interruptionsInclude() } } },
    }),
  create: (data: Prisma.ProcedureUncheckedCreateInput) => prisma.procedure.create({ data }),
  update: (id: number, data: Prisma.ProcedureUncheckedUpdateInput) =>
    prisma.procedure.update({ where: { id }, data }),
  delete: (id: number) => prisma.procedure.delete({ where: { id } }),
};

export default procedureModel;
