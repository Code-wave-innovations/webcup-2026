import type { ServiceInterruption } from "@prisma/client";
import prisma from "./prisma";
import { notifyUser } from "./notify";

// F38 / F63: citizens with an appointment during an interruption that makes the service
// unavailable are warned right away. Returns how many were notified.
export async function warnAppointments(interruption: ServiceInterruption & { service: { name: string } }) {
  if (interruption.impact !== "UNAVAILABLE") return 0;
  const appointments = await prisma.appointment.findMany({
    where: {
      service_id: interruption.service_id,
      status: "BOOKED",
      citizen_id: { not: null },
      slot: {
        ends_at: { gt: interruption.starts_at },
        ...(interruption.ends_at ? { starts_at: { lt: interruption.ends_at } } : {}),
      },
    },
    select: { id: true, reference: true, citizen_id: true },
  });
  for (const appointment of appointments) {
    await notifyUser(appointment.citizen_id!, {
      type: "SERVICE_INTERRUPTION",
      title: `${interruption.service.name} indisponible pendant votre rendez-vous ${appointment.reference}`,
      body: [interruption.reason, interruption.alternative].filter(Boolean).join("\n"),
      link: `/appointments/${appointment.id}`,
      data: { interruption_id: interruption.id, appointment_id: appointment.id },
    });
  }
  return appointments.length;
}
