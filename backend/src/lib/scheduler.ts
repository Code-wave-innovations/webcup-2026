import prisma from "./prisma";
import { auditAs } from "./audit";
import { notifyUser } from "./notify";
import { formatSlotLabel } from "./datetime";
import { activeAlertWhere, nextAlertStart, sendAlertNotifications } from "../model/alert.model";

// F40: appointment reminders, and D18 programmed alerts. Reminders are checked every minute;
// an alert programmed for a given hour is sent at that hour.
export const SCHEDULER_INTERVAL_MS = 60_000;

/** Wait until the next programmed alert, and never longer than a minute (reminders). */
export function schedulerDelay(nowMs: number, nextStart: Date | null, cap = SCHEDULER_INTERVAL_MS): number {
  if (!nextStart) return cap;
  const wait = nextStart.getTime() - nowMs;
  if (wait <= 0) return cap;
  return Math.min(cap, Math.max(250, wait));
}
export const MAX_REMINDER_OFFSET_MINUTES = 7 * 24 * 60;

export const sendDueReminders = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + MAX_REMINDER_OFFSET_MINUTES * 60_000);
  const candidates = await prisma.appointment.findMany({
    where: {
      status: "BOOKED",
      reminder_sent_at: null,
      // F40: null means the citizen asked for no reminder
      reminder_offset_minutes: { not: null },
      citizen_id: { not: null },
      slot: { starts_at: { gt: now, lte: horizon } },
    },
    include: { slot: { include: { service: { select: { name: true, address: true } } } } },
  });

  let sent = 0;
  for (const appointment of candidates) {
    const remindAt = appointment.slot.starts_at.getTime() - appointment.reminder_offset_minutes! * 60_000;
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

// D18: an alert programmed for later notifies the people concerned once it starts (same claim as above)
export const sendStartedAlerts = async (now = new Date()) => {
  const due = await prisma.alert.findMany({
    where: { ...activeAlertWhere(), notify: true, notified_at: null },
    include: { districts: { select: { district_id: true } } },
  });
  let sent = 0;
  for (const alert of due) {
    const recipients = await sendAlertNotifications({ ...alert, districts: alert.districts.map((d) => ({ id: d.district_id })) }, now);
    if (recipients === null) continue;
    sent += 1;
    await auditAs(null, null, { action: "alert.notified", entity: "Alert", entityId: alert.id, label: alert.title, metadata: { recipients } });
  }
  return sent;
};

export const startScheduler = () => {
  const arm = (delay: number) => {
    setTimeout(run, delay).unref();
  };
  const run = () => {
    Promise.all([sendDueReminders(), sendStartedAlerts()])
      .catch((error) => console.error("Scheduler failed:", error))
      .finally(() => {
        nextAlertStart(new Date(), true)
          .then((next) => arm(schedulerDelay(Date.now(), next)))
          .catch((error) => {
            console.error("Scheduler failed:", error);
            arm(SCHEDULER_INTERVAL_MS);
          });
      });
  };
  run();
};
