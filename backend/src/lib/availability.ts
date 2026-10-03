import type { InterruptionImpact, Prisma, ServiceInterruption } from "@prisma/client";
import prisma from "./prisma";
import { HttpError } from "./errors";

// F38: a service's availability is derived from its ServiceInterruption rows.

// Interruptions that are ongoing or still to come.
export const notEndedWhere = (): Prisma.ServiceInterruptionWhereInput => ({
  OR: [{ ends_at: null }, { ends_at: { gt: new Date() } }],
});

export const interruptionsInclude = () =>
  ({
    where: notEndedWhere(),
    orderBy: { starts_at: "asc" },
    take: 5,
  }) satisfies Prisma.CityService$interruptionsArgs;

type InterruptionLike = Pick<
  ServiceInterruption,
  "id" | "type" | "impact" | "reason" | "alternative" | "starts_at" | "ends_at"
>;

const IMPACT_RANK: Record<InterruptionImpact, number> = { DEGRADED: 1, UNAVAILABLE: 2 };

export const computeAvailability = (interruptions: InterruptionLike[], now = new Date()) => {
  const current = interruptions
    .filter((i) => i.starts_at <= now && (!i.ends_at || i.ends_at > now))
    .sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]);
  const worst = current[0] ?? null;
  return {
    status: worst ? (worst.impact === "UNAVAILABLE" ? "UNAVAILABLE" : "DEGRADED") : "AVAILABLE",
    current: worst,
    // When to come back (null = until further notice)
    back_at: worst?.ends_at ?? null,
    upcoming: interruptions.filter((i) => i.starts_at > now),
  };
};

// Replaces the raw `interruptions` relation by a computed `availability` object.
export const withAvailability = <T extends { interruptions?: InterruptionLike[] }>(service: T) => {
  const { interruptions, ...rest } = service;
  return { ...rest, availability: computeAvailability(interruptions ?? []) };
};

// UNAVAILABLE interruption overlapping [from, to], if any.
export const findBlockingInterruption = (serviceId: number, from: Date, to: Date = from) =>
  prisma.serviceInterruption.findFirst({
    where: {
      service_id: serviceId,
      impact: "UNAVAILABLE",
      starts_at: { lte: to },
      OR: [{ ends_at: null }, { ends_at: { gt: from } }],
    },
    orderBy: { ends_at: "desc" },
  });

export const assertServiceAvailable = async (serviceId: number, from = new Date(), to = from) => {
  const blocking = await findBlockingInterruption(serviceId, from, to);
  if (!blocking) return;
  throw new HttpError(409, "SERVICE_UNAVAILABLE", "This service is temporarily unavailable", {
    service_id: serviceId,
    reason: blocking.reason,
    alternative: blocking.alternative,
    back_at: blocking.ends_at,
  });
};
