import prisma from "./prisma";
import { auditAs } from "./audit";
import { notifyUser } from "./notify";
import { formatSlotLabel } from "./datetime";

// F40: appointment reminders, checked every minute by the API process.
export const MAX_REMINDER_OFFSET_MINUTES = 7 * 24 * 60;

export const sendDueReminders = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + MAX_REMINDER_OFFSET_MINUTES * 60_000);
  const candidates = await prisma.appointment.findMany({
    where: {
      status: "BOOKED",
      reminder_sent_at: null,
      citizen_id: { not: null },
      slot: { starts_at: { gt: now, lte: horizon } },
    },
    include: { slot: { include: { service: { select: { name: true, address: true } } } } },
  });

  let sent = 0;
  for (const appointment of candidates) {
    const remindAt = appointment.slot.starts_at.getTime() - appointment.reminder_offset_minutes * 60_000;
    if (remindAt > now.getTime()) continue;

    // Claim first so two processes never send the same reminder twice.
    const { count } = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminder_sent_at: null },
      data: { reminder_sent_at: now },
    });
    if (count === 0) continue;

    const { slot } = appointment;
    await notifyUser(appointment.citizen_id!, {
      type: "APPOINTMENT_REMINDER",
      title: `Rappel : rendez-vous ${slot.service.name}`,
      body: `${formatSlotLabel(slot.starts_at, slot.ends_at)} — ${slot.location}. Référence ${appointment.reference}.`,
      link: `/appointments/${appointment.id}`,
      data: { appointment_id: appointment.id, reference: appointment.reference, starts_at: slot.starts_at.toISOString() },
    });
    sent += 1;
  }
  // F47: the system's own work is traced too (actor null), only when it did something
  if (sent > 0) await auditAs(null, null, { action: "reminders.sent", entity: "Appointment", label: "Rappels automatiques", metadata: { sent } });
  return sent;
};

export const startScheduler = () => {
  const run = () => {
    sendDueReminders().catch((error) => console.error("Reminder job failed:", error));
  };
  run();
  setInterval(run, 60_000).unref();
};
