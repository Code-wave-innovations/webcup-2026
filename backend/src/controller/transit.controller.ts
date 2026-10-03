import type { Request, Response } from "express";
import { DayType, TransitLineStatus, TransitMode, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { notifyUsers } from "../lib/notify";
import { buildDepartures } from "../lib/transit";
import { HHMM_RE, dayTypeOf, hhmmToMinutes, toHHMM } from "../lib/datetime";
import { parseId, zBool, zId } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { audit, diffChanges } from "../lib/audit";

// F36: municipal transport lines, stops, timetables and live line status.

const zTime = z.string().regex(HHMM_RE, "Expected HH:MM");

const lineSummary = {
  id: true,
  code: true,
  name: true,
  mode: true,
  color: true,
  status: true,
  status_message: true,
} satisfies Prisma.TransitLineSelect;

const lineWhere = (value: string): Prisma.TransitLineWhereInput =>
  /^\d+$/.test(value) ? { id: Number(value) } : { code: value.toUpperCase() };

// ?day=&at= let the client look at another moment; default is now (server time zone).
const momentSchema = z.object({
  day: z.nativeEnum(DayType).optional(),
  at: zTime.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

const resolveMoment = (query: z.infer<typeof momentSchema>) => {
  const now = new Date();
  return { day: query.day ?? dayTypeOf(now), at: query.at ?? toHHMM(now) };
};

const lineSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(20),
  name: z.string().trim().min(1).max(191),
  mode: z.nativeEnum(TransitMode).optional(),
  color: z.string().trim().max(16).nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  is_active: zBool.optional(),
});

const stopSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(30),
  name: z.string().trim().min(1).max(191),
  district_id: zId.nullable().optional(),
  address: z.string().trim().max(191).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  accessible: zBool.optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(TransitLineStatus),
  status_message: z.string().trim().max(5000).nullable().optional(),
  // Notify residents of the districts served by the line
  notify: zBool.default(false),
});

const lineStopsSchema = z.object({ stop_ids: z.array(zId).min(1) });

// Either an explicit list or a regular service generated from the line's stop order.
const timetableSchema = z.union([
  z.object({
    day_type: z.nativeEnum(DayType),
    departures: z.array(z.object({ stop_id: zId, time: zTime, direction: z.string().max(191).optional() })),
  }),
  z.object({
    day_type: z.nativeEnum(DayType),
    first: zTime,
    last: zTime,
    every_minutes: z.coerce.number().int().min(1).max(240),
    minutes_between_stops: z.coerce.number().int().min(0).max(60).default(3),
    direction: z.string().max(191).optional(),
  }),
]);

const nextDepartures = (stopId: number, day: DayType, at: string, limit: number) =>
  prisma.transitDeparture.findMany({
    where: { stop_id: stopId, day_type: day, time: { gte: at }, line: { is_active: true } },
    orderBy: { time: "asc" },
    take: limit,
    include: { line: { select: lineSummary } },
  });

const withWait = (at: string) => (departure: { time: string }) => ({
  ...departure,
  minutes_until: hhmmToMinutes(departure.time) - hhmmToMinutes(at),
});

// Lines that are not running normally (also used by /api/home)
export const transitDisruptions = () =>
  prisma.transitLine.findMany({
    where: { is_active: true, status: { not: "NORMAL" } },
    select: lineSummary,
    orderBy: { code: "asc" },
  });

const transitController = {
  getLines: async (req: Request, res: Response) => {
    const showAll = isStaff(req.user) && req.query.include_inactive === "true";
    const lines = await prisma.transitLine.findMany({
      where: showAll ? {} : { is_active: true },
      orderBy: { code: "asc" },
      include: { _count: { select: { stops: true } } },
    });
    res.json(await translate("TransitLine", lines, resolveLocale(req)));
  },

  // Line, its ordered stops and the timetable of the requested day
  getLine: async (req: Request, res: Response) => {
    const { day } = resolveMoment(momentSchema.parse(req.query));
    const line = await prisma.transitLine.findFirst({
      where: { ...lineWhere(req.params.idOrCode), ...(isStaff(req.user) ? {} : { is_active: true }) },
      include: {
        stops: {
          orderBy: { position: "asc" },
          include: { stop: { include: { district: { select: { id: true, code: true, name: true } } } } },
        },
      },
    });
    if (!line) throw notFound("Line not found");

    const departures = await prisma.transitDeparture.findMany({
      where: { line_id: line.id, day_type: day },
      orderBy: { time: "asc" },
      select: { stop_id: true, time: true, direction: true },
    });
    const { stops, ...rest } = await translateOne("TransitLine", line, resolveLocale(req));
    res.json({
      ...rest,
      day_type: day,
      stops: stops.map(({ position, stop }) => ({
        position,
        ...stop,
        times: departures.filter((d) => d.stop_id === stop.id).map((d) => d.time),
      })),
    });
  },

  // Line status overview: only lines that are not running normally
  getDisruptions: async (req: Request, res: Response) => {
    res.json(await translate("TransitLine", await transitDisruptions(), resolveLocale(req)));
  },

  getStops: async (req: Request, res: Response) => {
    const { district_id, line_id, q } = z
      .object({
        district_id: zId.optional(),
        line_id: zId.optional(),
        q: z.string().trim().min(1).max(100).optional(),
      })
      .parse(req.query);
    const stops = await prisma.transitStop.findMany({
      where: {
        district_id,
        ...(line_id ? { lines: { some: { line_id } } } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { address: { contains: q } }] } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        district: { select: { id: true, code: true, name: true } },
        lines: { include: { line: { select: lineSummary } } },
      },
    });
    res.json(stops.map(({ lines, ...stop }) => ({ ...stop, lines: lines.map((l) => l.line) })));
  },

  // Everything a resident needs at a stop in one call: lines, their status, next departures.
  getStop: async (req: Request, res: Response) => {
    const query = momentSchema.parse(req.query);
    const { day, at } = resolveMoment(query);
    const stop = await prisma.transitStop.findUnique({
      where: { id: parseId(req.params.id) },
      include: {
        district: { select: { id: true, code: true, name: true } },
        lines: { include: { line: { select: lineSummary } } },
      },
    });
    if (!stop) throw notFound("Stop not found");

    const locale = resolveLocale(req);
    const departures = await nextDepartures(stop.id, day, at, query.limit);
    const { lines, ...rest } = stop;
    res.json({
      ...rest,
      lines: await translate("TransitLine", lines.map((l) => l.line), locale),
      day_type: day,
      at,
      next_departures: departures.map(withWait(at)),
    });
  },

  createLine: async (req: Request, res: Response) => {
    const line = await prisma.transitLine.create({ data: lineSchema.parse(req.body) });
    await audit(req, {
      action: "transit.line_status",
      entity: "TransitLine",
      entityId: line.id,
      label: `${line.code} ${line.name}`,
      changes: [{ field: "status", to: line.status }],
      metadata: { created: true },
      always: true,
    });
    res.status(201).json(line);
  },

  updateLine: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = lineSchema.partial().parse(req.body);
    const before = await prisma.transitLine.findUnique({ where: { id } });
    if (!before) throw notFound("Line not found");
    const line = await prisma.transitLine.update({ where: { id }, data: input });
    await audit(req, {
      action: "transit.line_status",
      entity: "TransitLine",
      entityId: line.id,
      label: `${line.code} ${line.name}`,
      changes: diffChanges(before, line, ["name", "color", "mode", "status", "status_message", "is_active"]),
    });
    res.json(line);
  },

  updateStatus: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const before = await prisma.transitLine.findUnique({ where: { id } });
    if (!before) throw notFound("Line not found");
    const { notify, ...data } = statusSchema.parse(req.body);
    if (data.status === "NORMAL" && data.status_message === undefined) data.status_message = null;
    const line = await prisma.transitLine.update({
      where: { id },
      data,
      include: { stops: { select: { stop: { select: { district_id: true } } } } },
    });

    let notified = 0;
    if (notify && line.status !== "NORMAL") {
      const districtIds = [
        ...new Set(line.stops.map((s) => s.stop.district_id).filter((d): d is number => d !== null)),
      ];
      if (districtIds.length) {
        notified = await notifyUsers(
          { district_id: { in: districtIds } },
          {
            type: "TRANSIT",
            title: `Ligne ${line.code} : ${line.status === "INTERRUPTED" ? "interrompue" : "perturbée"}`,
            body: line.status_message,
            link: `/transport/lines/${line.code}`,
            data: { line_id: line.id, status: line.status },
          }
        );
      }
    }
    await audit(req, {
      action: "transit.line_status",
      entity: "TransitLine",
      entityId: line.id,
      label: `${line.code} ${line.name}`,
      changes: diffChanges(before, line, ["status", "status_message"]),
      metadata: { notified },
    });
    const { stops: _stops, ...rest } = line;
    res.json({ ...rest, notified });
  },

  setLineStops: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const { stop_ids } = lineStopsSchema.parse(req.body);
    if (new Set(stop_ids).size !== stop_ids.length) throw badRequest("stop_ids contains duplicates");
    await prisma.$transaction([
      prisma.transitLineStop.deleteMany({ where: { line_id: id } }),
      prisma.transitLineStop.createMany({
        data: stop_ids.map((stop_id, position) => ({ line_id: id, stop_id, position })),
      }),
    ]);
    const line = await prisma.transitLine.findUnique({ where: { id }, select: { code: true, name: true } });
    await audit(req, {
      action: "transit.stops",
      entity: "TransitLine",
      entityId: id,
      label: line ? `${line.code} ${line.name}` : null,
      metadata: { stops: stop_ids.length },
      always: true,
    });
    res.json({ line_id: id, stop_ids });
  },

  // Replaces the timetable of one day type
  setTimetable: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = timetableSchema.parse(req.body);

    let rows: Prisma.TransitDepartureCreateManyInput[];
    if ("departures" in input) {
      rows = input.departures.map((d) => ({ ...d, line_id: id, day_type: input.day_type }));
    } else {
      const stops = await prisma.transitLineStop.findMany({ where: { line_id: id }, orderBy: { position: "asc" } });
      if (stops.length === 0) throw badRequest("Set the line's stops before generating a timetable");
      rows = buildDepartures(
        id,
        stops.map((s) => s.stop_id),
        {
          dayType: input.day_type,
          first: input.first,
          last: input.last,
          everyMinutes: input.every_minutes,
          minutesBetweenStops: input.minutes_between_stops,
          direction: input.direction,
        }
      );
    }

    await prisma.$transaction([
      prisma.transitDeparture.deleteMany({ where: { line_id: id, day_type: input.day_type } }),
      prisma.transitDeparture.createMany({ data: rows }),
    ]);
    const line = await prisma.transitLine.findUnique({ where: { id }, select: { code: true, name: true } });
    await audit(req, {
      action: "transit.timetable",
      entity: "TransitLine",
      entityId: id,
      label: line ? `${line.code} ${line.name}` : null,
      metadata: { day_type: input.day_type, departures: rows.length },
      always: true,
    });
    res.json({ line_id: id, day_type: input.day_type, departures: rows.length });
  },

  deleteLine: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const line = await prisma.transitLine.findUnique({ where: { id }, select: { code: true, name: true } });
    if (!line) throw notFound("Line not found");
    const deleted = await prisma.transitLine.delete({ where: { id }, select: { id: true } });
    await audit(req, {
      action: "transit.line_status",
      entity: "TransitLine",
      entityId: id,
      label: `${line.code} ${line.name}`,
      metadata: { deleted: true },
      always: true,
    });
    res.json(deleted);
  },

  createStop: async (req: Request, res: Response) => {
    const stop = await prisma.transitStop.create({ data: stopSchema.parse(req.body) });
    await audit(req, {
      action: "transit.stops",
      entity: "TransitStop",
      entityId: stop.id,
      label: stop.name,
      metadata: { created: true },
      always: true,
    });
    res.status(201).json(stop);
  },

  updateStop: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = stopSchema.partial().parse(req.body);
    const before = await prisma.transitStop.findUnique({ where: { id } });
    if (!before) throw notFound("Stop not found");
    const stop = await prisma.transitStop.update({ where: { id }, data: input });
    await audit(req, {
      action: "transit.stops",
      entity: "TransitStop",
      entityId: stop.id,
      label: stop.name,
      changes: diffChanges(before, stop, ["name", "code", "address", "district_id", "accessible"]),
    });
    res.json(stop);
  },

  deleteStop: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const stop = await prisma.transitStop.findUnique({ where: { id }, select: { name: true } });
    if (!stop) throw notFound("Stop not found");
    const deleted = await prisma.transitStop.delete({ where: { id }, select: { id: true } });
    await audit(req, {
      action: "transit.stops",
      entity: "TransitStop",
      entityId: id,
      label: stop.name,
      metadata: { deleted: true },
      always: true,
    });
    res.json(deleted);
  },
};

export default transitController;
