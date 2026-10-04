import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { escapeIcs, formatSlotLabel, slotClock, toIcsDate } from "../lib/datetime";

// F39 / F40 appointment helpers

export const generateAppointmentReference = () => {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `RDV-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
};

export const slotInclude = {
  service: { select: { id: true, slug: true, name: true, address: true, contact_phone: true, contact_email: true } },
  agent: { select: { id: true, name: true, last_name: true } },
} satisfies Prisma.AppointmentSlotInclude;

export const appointmentInclude = {
  slot: { include: slotInclude },
  procedure: { select: { id: true, slug: true, title: true, required_documents: true } },
  citizen: { select: { id: true, name: true, last_name: true, email: true, phone: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

// F39: everything needed to avoid any doubt about the slot and to prepare the visit.
export const presentAppointment = (appointment: AppointmentRow, options: { locale?: string; staff?: boolean } = {}) => {
  const { slot, agent_notes, ...rest } = appointment;
  const durationMinutes = Math.round((slot.ends_at.getTime() - slot.starts_at.getTime()) / 60000);
  const offset = appointment.reminder_offset_minutes;
  const reminderAt = offset === null ? null : new Date(slot.starts_at.getTime() - offset * 60000);
  const documents = Array.isArray(appointment.procedure?.required_documents)
    ? appointment.procedure!.required_documents
    : [];

  return {
    ...rest,
    ...(options.staff ? { agent_notes } : {}),
    when: {
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      duration_minutes: durationMinutes,
      label: formatSlotLabel(slot.starts_at, slot.ends_at, options.locale),
      // day, day_label, start_time, end_time, time_zone: in the city's time zone
      ...slotClock(slot.starts_at, slot.ends_at, options.locale),
    },
    where: {
      location: slot.location,
      service_address: slot.service.address,
    },
    with: slot.agent ? `${slot.agent.name} ${slot.agent.last_name}` : null,
    service: slot.service,
    preparation: {
      notes: slot.preparation_notes,
      required_documents: documents,
      bring: ["Votre référence de rendez-vous", ...documents.map(String)],
      contact: { phone: slot.service.contact_phone, email: slot.service.contact_email },
    },
    // F40: null offset and moment: the citizen asked for no reminder
    reminder: {
      offset_minutes: offset,
      scheduled_for: reminderAt,
      sent_at: appointment.reminder_sent_at,
    },
    calendar_url: `/api/appointments/${appointment.id}/ics`,
    slot_id: slot.id,
  };
};

export const toIcs = (appointment: AppointmentRow) => {
  const { slot } = appointment;
  const description = [
    `Référence : ${appointment.reference}`,
    `Motif : ${appointment.reason}`,
    slot.preparation_notes ? `À préparer : ${slot.preparation_notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Terra Nova//Rendez-vous//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${appointment.reference}@novaterra`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(slot.starts_at)}`,
    `DTEND:${toIcsDate(slot.ends_at)}`,
    `SUMMARY:${escapeIcs(`Rendez-vous ${slot.service.name}`)}`,
    `LOCATION:${escapeIcs([slot.location, slot.service.address].filter(Boolean).join(" — "))}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `STATUS:${appointment.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    // the calendar reminds at the same moment as the app, or not at all
    ...(appointment.reminder_offset_minutes === null
      ? []
      : [
          "BEGIN:VALARM",
          `TRIGGER:-PT${appointment.reminder_offset_minutes}M`,
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcs(`Rappel : rendez-vous ${slot.service.name}`)}`,
          "END:VALARM",
        ]),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
};
