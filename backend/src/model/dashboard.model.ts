import type { Prisma, RequestPriority, RequestType, Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { ACTION_NEEDED_STATUSES } from "./citizenRequest.model";
import { activeAlertWhere } from "./alert.model";

// D19 activity trends and F50 simplified dashboard. Days, hours and weekdays use the
// server time zone (TZ), like the rest of the wall-clock computations.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const REQUEST_TYPES: RequestType[] = ["CONTACT", "PROCEDURE", "INCIDENT"];
const STAFF_ROLES: Role[] = ["AGENT", "ADMIN"];

// D17 / F50: a request is overdue once the city still has to act on it past this delay (hours).
export const OVERDUE_HOURS: Record<RequestPriority, number> = { URGENT: 4, HIGH: 24, NORMAL: 72, LOW: 120 };

export const overdueWhere = (now: Date): Prisma.CitizenRequestWhereInput => ({
  status: { in: ACTION_NEEDED_STATUSES },
  OR: (Object.entries(OVERDUE_HOURS) as [RequestPriority, number][]).map(([priority, hours]) => ({
    priority,
    created_at: { lt: new Date(now.getTime() - hours * HOUR) },
  })),
});

// "Resolved" in the activity figures: answered positively, then possibly closed
const RESOLVED_WHERE: Prisma.CitizenRequestWhereInput = { status: { in: ["RESOLVED", "CLOSED"] } };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
// Monday = 0 … Sunday = 6
const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
};

// First pickup of a request: the first assignment or status change made by staff (D17).
// Returns the requests whose first pickup falls in [from, to), with their pickup delay in hours.
async function pickups(from: Date, to: Date) {
  const firsts = await prisma.requestEvent.groupBy({
    by: ["request_id"],
    where: { type: { in: ["ASSIGNED", "STATUS_CHANGED"] }, author: { role: { in: STAFF_ROLES } } },
    _min: { created_at: true },
    having: { created_at: { _min: { gte: from, lt: to } } },
  });
  if (!firsts.length) return [];
  const requests = await prisma.citizenRequest.findMany({
    where: { id: { in: firsts.map((row) => row.request_id) } },
    select: { id: true, created_at: true, service: { select: { id: true, name: true } } },
  });
  const byId = new Map(requests.map((request) => [request.id, request]));
  return firsts.flatMap((row) => {
    const request = byId.get(row.request_id);
    const at = row._min.created_at;
    if (!request || !at) return [];
    return [{ at, hours: Math.max(0, (at.getTime() - request.created_at.getTime()) / HOUR), service: request.service }];
  });
}

const emptyByType = () => Object.fromEntries(REQUEST_TYPES.map((type) => [type, 0])) as Record<RequestType, number>;

export async function trends(days: number, now = new Date()) {
  const from = startOfDay(new Date(now.getTime() - (days - 1) * DAY));

  const [created, resolved, picked, citizens, appointments, staffActions] = await Promise.all([
    prisma.citizenRequest.findMany({ where: { created_at: { gte: from } }, select: { created_at: true, type: true } }),
    prisma.citizenRequest.findMany({
      where: { ...RESOLVED_WHERE, resolved_at: { gte: from } },
      select: { resolved_at: true, type: true },
    }),
    pickups(from, now),
    prisma.user.findMany({ where: { role: "CITIZEN", created_at: { gte: from } }, select: { created_at: true } }),
    prisma.appointment.findMany({
      where: { status: { not: "CANCELLED" }, slot: { starts_at: { gte: from, lte: now } } },
      select: { slot: { select: { starts_at: true } } },
    }),
    // Staff actions until the audit log exists (BO-03): what agents did on the requests
    prisma.requestEvent.findMany({
      where: { created_at: { gte: from }, type: { not: "CREATED" }, author: { role: { in: STAFF_ROLES } } },
      select: { created_at: true },
    }),
  ]);

  const daily = new Map<string, {
    date: string;
    created: Record<RequestType, number> & { total: number };
    resolved: Record<RequestType, number> & { total: number };
    new_citizens: number;
    appointments: number;
    pickup_hours: number[];
  }>();
  for (let i = 0; i < days; i++) {
    const date = dayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
    daily.set(date, {
      date,
      created: { ...emptyByType(), total: 0 },
      resolved: { ...emptyByType(), total: 0 },
      new_citizens: 0,
      appointments: 0,
      pickup_hours: [],
    });
  }
  const at = (date: Date) => daily.get(dayKey(date));

  for (const request of created) {
    const day = at(request.created_at);
    if (!day) continue;
    day.created[request.type]++;
    day.created.total++;
  }
  for (const request of resolved) {
    const day = request.resolved_at && at(request.resolved_at);
    if (!day) continue;
    day.resolved[request.type]++;
    day.resolved.total++;
  }
  for (const pickup of picked) at(pickup.at)?.pickup_hours.push(pickup.hours);
  for (const citizen of citizens) {
    const day = at(citizen.created_at);
    if (day) day.new_citizens++;
  }
  for (const appointment of appointments) {
    const day = at(appointment.slot.starts_at);
    if (day) day.appointments++;
  }

  const byService = new Map<number, { service_id: number; name: string; hours: number[] }>();
  for (const pickup of picked) {
    if (!pickup.service) continue;
    const entry = byService.get(pickup.service.id) ?? { service_id: pickup.service.id, name: pickup.service.name, hours: [] };
    entry.hours.push(pickup.hours);
    byService.set(pickup.service.id, entry);
  }

  // Weekday × 2-hour block
  const grid = () => Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
  const heatmap = { requests: grid(), staff_actions: grid() };
  for (const request of created) heatmap.requests[weekdayIndex(request.created_at)][Math.floor(request.created_at.getHours() / 2)]++;
  for (const action of staffActions) heatmap.staff_actions[weekdayIndex(action.created_at)][Math.floor(action.created_at.getHours() / 2)]++;

  return {
    from: from.toISOString(),
    to: now.toISOString(),
    days,
    daily: [...daily.values()].map(({ pickup_hours, ...day }) => ({ ...day, median_pickup_hours: median(pickup_hours) })),
    median_pickup_hours: median(picked.map((pickup) => pickup.hours)),
    pickup_by_service: [...byService.values()]
      .map(({ hours, ...service }) => ({ ...service, median_hours: median(hours)!, count: hours.length }))
      .sort((a, b) => b.median_hours - a.median_hours),
    heatmap,
  };
}

// ─── F50 summary ────────────────────────────────────────────────────────────

export type SummaryPeriod = "today" | "7d" | "30d";

export function periodBounds(period: SummaryPeriod, now = new Date()) {
  const from = period === "today" ? startOfDay(now) : new Date(now.getTime() - (period === "7d" ? 7 : 30) * DAY);
  // Today is compared with yesterday at the same time; 7 / 30 days with the window just before.
  const span = period === "today" ? DAY : now.getTime() - from.getTime();
  return {
    from,
    to: now,
    previous_from: new Date(from.getTime() - span),
    previous_to: new Date(now.getTime() - span),
  };
}

const formatAge = (ms: number) => {
  const hours = Math.floor(ms / HOUR);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
};

const formatSince = (date: Date, now: Date) => {
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (dayKey(date) === dayKey(now)) return `depuis ${time}`;
  return `depuis le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date)} à ${time}`;
};

export interface WatchItem {
  kind: "overdue_request" | "service_unavailable" | "service_degraded" | "active_alert";
  severity: "critical" | "warning";
  label: string;
  link: string | null;
}

// At most 5 items, the most serious first. Labels are written here so that every screen shows the same.
async function watchList(role: Role, now: Date): Promise<WatchItem[]> {
  const admin = role === "ADMIN";
  const space = admin ? "/admin" : "/agent";

  const [alerts, interruptions, overdue] = await Promise.all([
    prisma.alert.findMany({
      where: { ...activeAlertWhere(), severity: { in: ["CRITICAL", "WARNING"] } },
      orderBy: [{ severity: "desc" }, { starts_at: "desc" }],
      take: 5,
      select: { id: true, title: true, severity: true, audience: true, districts: { select: { district: { select: { name: true } } } } },
    }),
    prisma.serviceInterruption.findMany({
      where: { starts_at: { lte: now }, OR: [{ ends_at: null }, { ends_at: { gt: now } }] },
      orderBy: { starts_at: "asc" },
      take: 5,
      select: { impact: true, starts_at: true, service: { select: { name: true } } },
    }),
    prisma.citizenRequest.findMany({
      where: overdueWhere(now),
      orderBy: [{ priority: "desc" }, { created_at: "asc" }],
      take: 5,
      select: { id: true, reference: true, status: true, priority: true, created_at: true },
    }),
  ]);

  const ranked: (WatchItem & { rank: number })[] = [
    ...alerts.map((alert) => {
      // District names already in the title are not repeated
      const where = alert.districts
        .map((row) => row.district.name)
        .filter((name) => !alert.title.toLowerCase().includes(name.toLowerCase()))
        .join(", ");
      return {
        kind: "active_alert" as const,
        severity: alert.severity === "CRITICAL" ? ("critical" as const) : ("warning" as const),
        rank: alert.severity === "CRITICAL" ? 0 : 3,
        label: `Alerte en cours : ${alert.title}${where ? ` · ${where}` : alert.audience === "VULNERABLE" ? " · personnes vulnérables" : ""}`,
        link: admin ? `${space}/alertes` : null,
      };
    }),
    ...overdue.map((request) => {
      const age = formatAge(now.getTime() - request.created_at.getTime());
      const urgent = request.priority === "URGENT" || request.priority === "HIGH";
      return {
        kind: "overdue_request" as const,
        severity: urgent ? ("critical" as const) : ("warning" as const),
        rank: request.priority === "URGENT" ? 1 : request.priority === "HIGH" ? 2 : 4,
        label:
          request.status === "SUBMITTED"
            ? `${request.reference} attend une prise en charge depuis ${age}`
            : `${request.reference} est ouverte depuis ${age}`,
        link: `${space}/demandes/${request.id}`,
      };
    }),
    ...interruptions.map((interruption) => {
      const down = interruption.impact === "UNAVAILABLE";
      return {
        kind: down ? ("service_unavailable" as const) : ("service_degraded" as const),
        severity: down ? ("critical" as const) : ("warning" as const),
        rank: down ? 2 : 5,
        label: `${interruption.service.name} : service ${down ? "indisponible" : "perturbé"} ${formatSince(interruption.starts_at, now)}`,
        link: admin ? `${space}/maintenance` : null,
      };
    }),
  ];

  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map(({ rank: _rank, ...item }) => item);
}

const countAppointments = (range: { gte: Date; lt: Date }, status?: "NO_SHOW") =>
  prisma.appointment.count({ where: { status: status ?? { not: "CANCELLED" }, slot: { starts_at: range } } });

const wholeDay = (date: Date) => {
  const from = startOfDay(date);
  return { gte: from, lt: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
};

// F39: appointments of the day, including those still to come
export const appointmentsToday = (now = new Date()) => countAppointments(wholeDay(now));

export async function summary(period: SummaryPeriod, role: Role, now = new Date()) {
  const bounds = periodBounds(period, now);
  const current = { gte: bounds.from, lt: bounds.to };
  const previous = { gte: bounds.previous_from, lt: bounds.previous_to };
  // Today's appointments are known in advance: the whole day, compared with the whole of yesterday
  const appointmentRange = period === "today" ? wholeDay(now) : current;
  const previousAppointmentRange = period === "today" ? wholeDay(bounds.previous_from) : previous;

  const countRequests = (range: typeof current) => prisma.citizenRequest.count({ where: { created_at: range } });
  const countResolved = (range: typeof current) => prisma.citizenRequest.count({ where: { ...RESOLVED_WHERE, resolved_at: range } });
  const countCitizens = (range: typeof current) => prisma.user.count({ where: { role: "CITIZEN", created_at: range } });

  const [
    received,
    receivedBefore,
    resolved,
    resolvedBefore,
    awaiting,
    oldestAwaiting,
    overdue,
    picked,
    pickedBefore,
    appointments,
    appointmentsBefore,
    noShow,
    citizens,
    citizensBefore,
    watch,
  ] = await Promise.all([
    countRequests(current),
    countRequests(previous),
    countResolved(current),
    countResolved(previous),
    prisma.citizenRequest.count({ where: { status: "SUBMITTED" } }),
    prisma.citizenRequest.findFirst({ where: { status: "SUBMITTED" }, orderBy: { created_at: "asc" }, select: { created_at: true } }),
    prisma.citizenRequest.count({ where: overdueWhere(now) }),
    pickups(bounds.from, bounds.to),
    pickups(bounds.previous_from, bounds.previous_to),
    countAppointments(appointmentRange),
    countAppointments(previousAppointmentRange),
    countAppointments(appointmentRange, "NO_SHOW"),
    countCitizens(current),
    countCitizens(previous),
    watchList(role, now),
  ]);

  return {
    period: {
      key: period,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
      previous_from: bounds.previous_from.toISOString(),
      previous_to: bounds.previous_to.toISOString(),
    },
    indicators: {
      requests_received: { value: received, previous: receivedBefore },
      requests_resolved: { value: resolved, previous: resolvedBefore },
      // Snapshots: no previous value
      awaiting_pickup: { value: awaiting, previous: null, oldest_at: oldestAwaiting?.created_at.toISOString() ?? null },
      overdue: { value: overdue, previous: null },
      median_pickup_hours: {
        value: median(picked.map((pickup) => pickup.hours)),
        previous: median(pickedBefore.map((pickup) => pickup.hours)),
      },
      appointments: { value: appointments, previous: appointmentsBefore, no_show: noShow },
      new_citizens: { value: citizens, previous: citizensBefore },
    },
    watch,
  };
}

// ─── Staff activity ─────────────────────────────────────────────────────────

// The latest actions of agents and admins on the requests (status, assignment, priority, notes)
export const activity = (limit: number) =>
  prisma.requestEvent.findMany({
    where: { type: { not: "CREATED" }, author: { role: { in: STAFF_ROLES } } },
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true,
      created_at: true,
      type: true,
      from_status: true,
      to_status: true,
      message: true,
      is_internal: true,
      author: { select: { id: true, name: true, last_name: true, role: true } },
      request: { select: { id: true, reference: true, subject: true } },
    },
  });
