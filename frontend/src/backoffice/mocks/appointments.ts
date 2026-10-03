import type { Appointment, AppointmentSlot } from './types'
import { atTime } from './time'

const LOCATIONS: Record<number, string> = {
  1: 'Hôtel de ville — bureau 4',
  2: 'Hôtel de ville — guichet 2',
  3: 'Centre de santé — accueil',
}

const NOTES: Record<number, string> = {
  1: 'Munissez-vous de votre livret de famille si vous en avez un.',
  2: 'Apportez une pièce d’identité et un justificatif de logement.',
  3: 'Présentez-vous 10 minutes avant avec vos ordonnances en cours.',
}

/** Weekday mornings for the next days, 30-minute slots, three services. */
function buildSlots(): AppointmentSlot[] {
  const slots: AppointmentSlot[] = []
  let id = 1
  for (let day = 0; day < 7; day++) {
    // the city's offices are closed on Sundays
    if (new Date(atTime(9, 0, day)).getDay() === 0) continue
    for (let minutes = 9 * 60; minutes < 12 * 60; minutes += 30) {
      for (const serviceId of [1, 2, 3]) {
        const startsAt = atTime(Math.floor(minutes / 60), minutes % 60, day)
        slots.push({
          id: id++,
          service_id: serviceId,
          agent_id: serviceId === 3 ? 3 : 2,
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
          location: LOCATIONS[serviceId],
          capacity: serviceId === 2 ? 2 : 1,
          preparation_notes: NOTES[serviceId],
          is_active: true,
        })
      }
    }
  }
  return slots
}

export const SLOTS: AppointmentSlot[] = buildSlots()

const book = (id: number, slotIndex: number, citizen: number, reason: string, status: Appointment['status'] = 'BOOKED'): Appointment => {
  const slot = SLOTS[slotIndex]
  return {
    id,
    reference: `RDV-${String(261003 + id)}-${(id * 104729).toString(16).toUpperCase().slice(-4)}`,
    slot_id: slot.id,
    citizen_id: citizen,
    service_id: slot.service_id,
    reason,
    status,
    agent_notes: null,
    reminder_offset_minutes: 1440,
    reminder_sent_at: null,
  }
}

export const APPOINTMENTS: Appointment[] = [
  book(1, 0, 16, 'Acte de naissance — copie intégrale', 'COMPLETED'),
  book(2, 4, 13, 'Inscription famille de 4 personnes'),
  book(3, 5, 12, 'Suivi tension artérielle'),
  book(4, 9, 11, 'Livret de famille', 'NO_SHOW'),
  book(5, 13, 14, 'Renouvellement d’ordonnance'),
  book(6, 19, 20, 'Premier rendez-vous d’accueil'),
  book(7, 22, 15, 'Acte de mariage'),
  book(8, 25, 18, 'Inscription nouvel habitant', 'CANCELLED'),
  book(9, 31, 12, 'Vaccination saisonnière'),
  book(10, 40, 16, 'Changement de nom d’usage'),
  book(11, 46, 13, 'Justificatif de domicile'),
]
