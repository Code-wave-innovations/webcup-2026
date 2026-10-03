import type { Request, Response } from "express";
import { AppointmentStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { HttpError, badRequest, conflict, notFound } from "../lib/errors";
import { notifyUser } from "../lib/notify";
import { assertServiceAvailable } from "../lib/availability";
import { HHMM_RE, formatSlotLabel } from "../lib/datetime";
import { MAX_REMINDER_OFFSET_MINUTES, sendDueReminders } from "../lib/scheduler";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zDate, zId } from "../lib/validation";
import { resolveLocale } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import {
  appointmentInclude,
  generateAppointmentReference,
  presentAppointment,
  slotInclude,
  toIcs,
} from "../model/appointment.model";

// F39 appointments with an agent, F40 reminders

const zReminder = z.coerce.number().int().min(15).max(MAX_REMINDER_OFFSET_MINUTES);
const bookedCount = { _count: { select: { appointments: { where: { status: "BOOKED" as const } } } } };

const slotsQuerySchema = z.object({
  service_id: zId.optional(),
  agent_id: zId.optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  // Staff only: include full and inactive slots
  all: zBool.optional(),
});

const slotSchema = z.object({
  service_id: zId,
  agent_id: zId.nullable().optional(),
  starts_at: zDate,
  ends_at: zDate,
  location: z.string().trim().min(1).max(191),
  capacity: z.coerce.number().int().min(1).max(100).default(1),
  preparation_notes: z.string().trim().max(5000).nullable().optional(),
});

const bulkSlotSchema = z.object({
  service_id: zId,
  agent_id: zId.nullable().optional(),
  location: z.string().trim().min(1).max(191),
  capacity: z.coerce.number().int().min(1).max(100).default(1),
  preparation_notes: z.string().trim().max(5000).nullable().optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(HHMM_RE),
  end_time: z.string().regex(HHMM_RE),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  // ISO weekdays: 1 = Monday … 7 = Sunday
  weekdays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
});

const slotUpdateSchema = slotSchema.omit({ service_id: true }).partial().extend({ is_active: zBool.optional() });

const bookSchema = z.object({
  slot_id: zId,
  reason: z.string().trim().min(3).max(2000),
  procedure_id: zId.optional(),
  reminder_offset_minutes: zReminder.default(1440),
});

const listQuerySchema = paginationSchema.extend({
  scope: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  status: z.nativeEnum(AppointmentStatus).optional(),
  service_id: zId.optional(),
  // Staff only: appointments of the slots assigned to me
  mine: zBool.optional(),
});

const staffUpdateSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  agent_notes: z.string().trim().max(5000).nullable().optional(),
});

const cancelSchema = z.object({ reason: z.string().trim().max(1000).optional() });

const loadVisible = async (req: Request) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: parseId(req.params.id) },
    include: appointmentInclude,
  });
  if (!appointment || (!isStaff(req.user) && appointment.citizen_id !== req.user!.id)) {
    throw notFound("Appointment not found");
  }
  return appointment;
};

const present = (req: Request, appointment: Parameters<typeof presentAppointment>[0]) =>
  presentAppointment(appointment, { locale: resolveLocale(req), staff: isStaff(req.user) });

const appointmentController = {
  // Bookable slots (with remaining places); public so visitors can see availability before signing in
  getSlots: async (req: Request, res: Response) => {
    const { service_id, agent_id, from, to, all } = slotsQuerySchema.parse(req.query);
    const staffView = all && isStaff(req.user);
    const now = new Date();
    const start = from && from > now ? from : now;
    const end = to ?? new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    const slots = await prisma.appointmentSlot.findMany({
      where: {
        service_id,
        agent_id,
        starts_at: { gte: staffView && from ? from : start, lte: end },
        ...(staffView ? {} : { is_active: true }),
      },
      orderBy: { starts_at: "asc" },
      take: 500,
      include: { ...slotInclude, ...bookedCount },
    });
    const locale = resolveLocale(req);
    res.json(
      slots
        .map(({ _count, ...slot }) => ({
          ...slot,
          booked: _count.appointments,
          remaining: slot.capacity - _count.appointments,
          label: formatSlotLabel(slot.starts_at, slot.ends_at, locale),
        }))
        .filter((slot) => staffView || slot.remaining > 0)
    );
  },

  createSlot: async (req: Request, res: Response) => {
    const input = slotSchema.parse(req.body);
    if (input.ends_at <= input.starts_at) throw badRequest("ends_at must be after starts_at");
    res.status(201).json(await prisma.appointmentSlot.create({ data: input, include: slotInclude }));
  },

  // Publishes a series of slots, e.g. every 30 min from 09:00 to 12:00, Monday to Friday.
  createSlotsBulk: async (req: Request, res: Response) => {
    const input = bulkSlotSchema.parse(req.body);
    const [startH, startM] = input.start_time.split(":").map(Number);
    const [endH, endM] = input.end_time.split(":").map(Number);
    const first = new Date(`${input.from_date}T00:00:00`);
    const last = new Date(`${input.to_date}T00:00:00`);
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || last < first) {
      throw badRequest("Invalid date range");
    }
    if ((last.getTime() - first.getTime()) / 86_400_000 > 62) throw badRequest("The range cannot exceed 62 days");

    const now = new Date();
    const data: Prisma.AppointmentSlotCreateManyInput[] = [];
    for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
      const isoWeekday = day.getDay() === 0 ? 7 : day.getDay();
      if (!input.weekdays.includes(isoWeekday)) continue;
      const dayEnd = new Date(day);
      dayEnd.setHours(endH, endM, 0, 0);
      const cursor = new Date(day);
      cursor.setHours(startH, startM, 0, 0);
      while (cursor.getTime() + input.duration_minutes * 60_000 <= dayEnd.getTime()) {
        const startsAt = new Date(cursor);
        cursor.setMinutes(cursor.getMinutes() + input.duration_minutes);
        if (startsAt <= now) continue;
        data.push({
          service_id: input.service_id,
          agent_id: input.agent_id,
          location: input.location,
          capacity: input.capacity,
          preparation_notes: input.preparation_notes,
          starts_at: startsAt,
          ends_at: new Date(cursor),
        });
      }
    }
    if (data.length === 0) throw badRequest("No slot matches these settings");
    if (data.length > 1000) throw badRequest("Too many slots at once (max 1000)");
    const { count } = await prisma.appointmentSlot.createMany({ data });
    res.status(201).json({ created: count });
  },

  updateSlot: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = slotUpdateSchema.parse(req.body);
    const slot = await prisma.appointmentSlot.findUnique({ where: { id }, include: bookedCount });
    if (!slot) throw notFound("Slot not found");
    const booked = slot._count.appointments;
    // Moving a booked slot would make the citizen's confirmation wrong: cancel and rebook instead.
    if (booked > 0 && (input.starts_at || input.ends_at)) {
      throw conflict("This slot already has bookings; its time cannot be changed");
    }
    if (input.capacity !== undefined && input.capacity < booked) {
      throw conflict(`Capacity cannot be lower than the ${booked} existing booking(s)`);
    }
    res.json(await prisma.appointmentSlot.update({ where: { id }, data: input, include: slotInclude }));
  },

  // Removes a free slot, or deactivates a booked one and cancels its bookings (citizens are notified).
  deleteSlot: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id },
      include: { ...slotInclude, appointments: { where: { status: "BOOKED" } } },
    });
    if (!slot) throw notFound("Slot not found");
    if (slot.appointments.length === 0) {
      await prisma.appointmentSlot.delete({ where: { id } });
      res.json({ id, deleted: true });
      return;
    }
    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { slot_id: id, status: "BOOKED" },
        data: { status: "CANCELLED", cancelled_at: new Date() },
      }),
      prisma.appointmentSlot.update({ where: { id }, data: { is_active: false } }),
    ]);
    for (const appointment of slot.appointments) {
      if (!appointment.citizen_id) continue;
      await notifyUser(appointment.citizen_id, {
        type: "APPOINTMENT_CANCELLED",
        title: `Rendez-vous ${appointment.reference} annulé par ${slot.service.name}`,
        body: `${formatSlotLabel(slot.starts_at, slot.ends_at)}. Merci de choisir un nouveau créneau.`,
        link: `/appointments/${appointment.id}`,
        data: { appointment_id: appointment.id },
      });
    }
    res.json({ id, deleted: false, deactivated: true, cancelled: slot.appointments.length });
  },

  book: async (req: Request, res: Response) => {
    const input = bookSchema.parse(req.body);
    const citizenId = req.user!.id;

    const preview = await prisma.appointmentSlot.findUnique({ where: { id: input.slot_id } });
    if (!preview || !preview.is_active) throw notFound("Slot not found");
    if (preview.starts_at <= new Date()) throw badRequest("This slot is in the past");
    // F38: no booking during an interruption of the service
    await assertServiceAvailable(preview.service_id, preview.starts_at, preview.ends_at);
    if (input.procedure_id) {
      const procedure = await prisma.procedure.findFirst({
        where: { id: input.procedure_id, service_id: preview.service_id, is_active: true },
      });
      if (!procedure) throw badRequest("This procedure does not belong to the slot's service");
    }

    const created = await prisma.$transaction(async (tx) => {
      // Row lock: two citizens cannot take the last place at the same time.
      await tx.$queryRaw`SELECT id FROM AppointmentSlot WHERE id = ${input.slot_id} FOR UPDATE`;
      const slot = await tx.appointmentSlot.findUniqueOrThrow({ where: { id: input.slot_id }, include: bookedCount });
      if (slot._count.appointments >= slot.capacity) {
        throw new HttpError(409, "SLOT_FULL", "This slot has just been taken, please choose another one");
      }
      const overlapping = await tx.appointment.findFirst({
        where: {
          citizen_id: citizenId,
          status: "BOOKED",
          slot: { starts_at: { lt: slot.ends_at }, ends_at: { gt: slot.starts_at } },
        },
        select: { reference: true },
      });
      if (overlapping) {
        throw new HttpError(409, "OVERLAPPING_APPOINTMENT", `You already have appointment ${overlapping.reference} at that time`);
      }

      const reminderDue = slot.starts_at.getTime() - input.reminder_offset_minutes * 60_000 <= Date.now();
      return tx.appointment.create({
        data: {
          reference: generateAppointmentReference(),
          slot_id: slot.id,
          service_id: slot.service_id,
          citizen_id: citizenId,
          procedure_id: input.procedure_id,
          reason: input.reason,
          reminder_offset_minutes: input.reminder_offset_minutes,
          // Booked inside the reminder window: the confirmation below already serves as reminder.
          reminder_sent_at: reminderDue ? new Date() : null,
        },
        include: appointmentInclude,
      });
    });

    const appointment = present(req, created);
    await notifyUser(citizenId, {
      type: "APPOINTMENT_BOOKED",
      title: `Rendez-vous confirmé : ${appointment.service.name}`,
      body: `${appointment.when.label} — ${appointment.where.location}. Référence ${created.reference}.`,
      link: `/appointments/${created.id}`,
      data: { appointment_id: created.id, reference: created.reference },
    });

    res.status(201).json({
      message: `Votre rendez-vous est confirmé le ${appointment.when.label} (${appointment.where.location}). Référence ${created.reference}.`,
      reference: created.reference,
      appointment,
    });
  },

  // Citizens: their appointments. Staff: everyone's.
  getAll: async (req: Request, res: Response) => {
    const { scope, status, service_id, mine, ...pagination } = listQuerySchema.parse(req.query);
    const user = req.user!;
    const now = new Date();
    const where: Prisma.AppointmentWhereInput = {
      status,
      service_id,
      ...(isStaff(user) ? {} : { citizen_id: user.id }),
      slot: {
        ...(scope === "upcoming" ? { starts_at: { gte: now } } : scope === "past" ? { starts_at: { lt: now } } : {}),
        ...(isStaff(user) && mine ? { agent_id: user.id } : {}),
      },
    };
    const { skip, take } = toSkipTake(pagination);
    const [rows, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        orderBy: { slot: { starts_at: scope === "upcoming" ? "asc" : "desc" } },
        skip,
        take,
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ]);
    res.json({ data: rows.map((row) => present(req, row)), meta: pageMeta(pagination, total) });
  },

  getOne: async (req: Request, res: Response) => {
    res.json(present(req, await loadVisible(req)));
  },

  // Adds the appointment to the citizen's calendar, with an alarm matching the reminder.
  ics: async (req: Request, res: Response) => {
    const appointment = await loadVisible(req);
    res.type("text/calendar").attachment(`${appointment.reference}.ics`).send(toIcs(appointment));
  },

  cancel: async (req: Request, res: Response) => {
    const appointment = await loadVisible(req);
    const { reason } = cancelSchema.parse(req.body ?? {});
    const staff = isStaff(req.user);
    if (appointment.status !== "BOOKED") throw conflict("Only a booked appointment can be cancelled");
    if (!staff && appointment.slot.starts_at <= new Date()) throw conflict("This appointment has already started");

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED", cancelled_at: new Date() },
      include: appointmentInclude,
    });
    const label = formatSlotLabel(appointment.slot.starts_at, appointment.slot.ends_at);
    if (staff && appointment.citizen_id) {
      await notifyUser(appointment.citizen_id, {
        type: "APPOINTMENT_CANCELLED",
        title: `Rendez-vous ${appointment.reference} annulé par la mairie`,
        body: [label, reason].filter(Boolean).join("\n"),
        link: `/appointments/${appointment.id}`,
        data: { appointment_id: appointment.id },
      });
    } else if (!staff && appointment.slot.agent) {
      await notifyUser(appointment.slot.agent.id, {
        type: "APPOINTMENT_CANCELLED",
        title: `Rendez-vous ${appointment.reference} annulé par le citoyen`,
        body: [label, reason].filter(Boolean).join("\n"),
        link: `/appointments/${appointment.id}`,
        data: { appointment_id: appointment.id },
      });
    }
    res.json(present(req, updated));
  },

  // F40: the citizen chooses when to be reminded
  updateReminder: async (req: Request, res: Response) => {
    const appointment = await loadVisible(req);
    const { reminder_offset_minutes } = z.object({ reminder_offset_minutes: zReminder }).parse(req.body);
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminder_offset_minutes, reminder_sent_at: null },
      include: appointmentInclude,
    });
    res.json(present(req, updated));
  },

  // Staff: mark as completed / no-show, keep internal notes
  update: async (req: Request, res: Response) => {
    const appointment = await loadVisible(req);
    const input = staffUpdateSchema.parse(req.body);
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { ...input, ...(input.status === "CANCELLED" ? { cancelled_at: new Date() } : {}) },
      include: appointmentInclude,
    });
    res.json(present(req, updated));
  },

  // Admin/demo: run the reminder job now instead of waiting for the next minute
  runReminders: async (_req: Request, res: Response) => {
    res.json({ sent: await sendDueReminders() });
  },
};

export default appointmentController;
