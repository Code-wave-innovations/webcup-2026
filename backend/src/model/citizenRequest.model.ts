import { randomBytes } from "crypto";
import type { Prisma, RequestStatus } from "@prisma/client";
import prisma from "../lib/prisma";

// Not finished yet (citizen-facing "en cours").
export const OPEN_STATUSES: RequestStatus[] = ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS", "WAITING_CITIZEN"];
// F22: the city still has to act (WAITING_CITIZEN is on the citizen's side).
export const ACTION_NEEDED_STATUSES: RequestStatus[] = ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"];
export const FINAL_STATUSES: RequestStatus[] = ["RESOLVED", "REJECTED", "CLOSED"];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: "Envoyée",
  IN_REVIEW: "En cours d'examen",
  IN_PROGRESS: "En cours de traitement",
  WAITING_CITIZEN: "En attente de votre réponse",
  RESOLVED: "Résolue",
  REJECTED: "Refusée",
  CLOSED: "Clôturée",
};

// D16: short confirmation number, e.g. NT-261003-4F9A2C
export const generateReference = () => {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `NT-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
};

const personSelect = { select: { id: true, name: true, last_name: true, email: true } };

export const requestListInclude = {
  service: { select: { id: true, slug: true, name: true } },
  procedure: { select: { id: true, slug: true, title: true } },
  district: { select: { id: true, code: true, name: true } },
  citizen: personSelect,
  assigned_agent: personSelect,
  _count: { select: { events: true } },
} satisfies Prisma.CitizenRequestInclude;

const citizenRequestModel = {
  list: (
    where: Prisma.CitizenRequestWhereInput,
    orderBy: Prisma.CitizenRequestOrderByWithRelationInput[],
    skip: number,
    take: number
  ) =>
    prisma.$transaction([
      prisma.citizenRequest.findMany({ where, orderBy, skip, take, include: requestListInclude }),
      prisma.citizenRequest.count({ where }),
    ]),

  // Internal events (agent notes) are hidden unless includeInternal.
  getDetail: (id: number, includeInternal: boolean) =>
    prisma.citizenRequest.findUnique({
      where: { id },
      include: {
        ...requestListInclude,
        events: {
          where: includeInternal ? {} : { is_internal: false },
          orderBy: { created_at: "asc" },
          include: { author: { select: { id: true, name: true, last_name: true, role: true } } },
        },
      },
    }),

  getById: (id: number) => prisma.citizenRequest.findUnique({ where: { id } }),

  create: (data: Omit<Prisma.CitizenRequestUncheckedCreateInput, "reference">, authorId?: number) =>
    prisma.citizenRequest.create({
      data: {
        ...data,
        reference: generateReference(),
        events: { create: { type: "CREATED", to_status: "SUBMITTED", author_id: authorId } },
      },
      include: requestListInclude,
    }),

  update: (
    id: number,
    data: Prisma.CitizenRequestUncheckedUpdateInput,
    events: Omit<Prisma.RequestEventCreateManyInput, "request_id">[]
  ) =>
    prisma.$transaction(async (tx) => {
      const request = await tx.citizenRequest.update({ where: { id }, data, include: requestListInclude });
      if (events.length) {
        await tx.requestEvent.createMany({ data: events.map((event) => ({ ...event, request_id: id })) });
      }
      return request;
    }),

  delete: (id: number) => prisma.citizenRequest.delete({ where: { id }, select: { id: true, reference: true } }),
};

export default citizenRequestModel;
