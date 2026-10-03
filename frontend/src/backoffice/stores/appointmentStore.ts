import { create } from 'zustand'
import { APPOINTMENTS, SLOTS } from '../mocks/appointments'
import type { Appointment, AppointmentSlot, AppointmentStatus } from '../mocks/types'
import { APPOINTMENT_LABEL } from '../lib/labels'
import { toast } from './toastStore'

interface AppointmentState {
  slots: AppointmentSlot[]
  appointments: Appointment[]
}

export const useAppointmentStore = create<AppointmentState>()(() => ({ slots: SLOTS, appointments: APPOINTMENTS }))

let nextSlotId = 10_000

/* Simulated appointment management (F39, F40). */

export function setAppointmentStatus(id: number, status: AppointmentStatus) {
  const appointment = useAppointmentStore.getState().appointments.find((a) => a.id === id)
  if (!appointment || appointment.status === status) return
  useAppointmentStore.setState((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)) }))
  toast(`${appointment.reference} : ${APPOINTMENT_LABEL[status].toLowerCase()}`, status === 'NO_SHOW' || status === 'CANCELLED' ? 'alert' : 'ok')
}

export function saveAgentNotes(id: number, notes: string) {
  const appointment = useAppointmentStore.getState().appointments.find((a) => a.id === id)
  if (!appointment) return
  useAppointmentStore.setState((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, agent_notes: notes } : a)) }))
  toast('Note enregistrée')
}

/** Bulk slot generator (POST /api/appointments/slots/bulk). */
export function addSlots(
  input: { service_id: number; agent_id: number | null; location: string; capacity: number; dates: string[]; start: string; end: string; duration: number },
): number {
  const created: AppointmentSlot[] = []
  const [sh, sm] = input.start.split(':').map(Number)
  const [eh, em] = input.end.split(':').map(Number)
  for (const date of input.dates) {
    const cursor = new Date(`${date}T00:00:00`)
    cursor.setHours(sh, sm, 0, 0)
    const end = new Date(`${date}T00:00:00`)
    end.setHours(eh, em, 0, 0)
    while (cursor.getTime() + input.duration * 60_000 <= end.getTime()) {
      const startsAt = cursor.toISOString()
      cursor.setMinutes(cursor.getMinutes() + input.duration)
      created.push({
        id: nextSlotId++,
        service_id: input.service_id,
        agent_id: input.agent_id,
        starts_at: startsAt,
        ends_at: cursor.toISOString(),
        location: input.location,
        capacity: input.capacity,
        preparation_notes: null,
        is_active: true,
      })
    }
  }
  if (created.length === 0) {
    toast('Aucun créneau ne correspond à ces réglages', 'alert')
    return 0
  }
  useAppointmentStore.setState((s) => ({ slots: [...s.slots, ...created] }))
  toast(`${created.length} créneaux publiés`)
  return created.length
}
