import type { Appointment, AppointmentSlot } from '../mocks/types'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '../lib/labels'
import { formatDay, formatTime } from '../lib/format'
import { fullName, useServiceName, useUsersById } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import styles from './shared.module.css'

const TONE_VAR = {
  ice: 'var(--color-ice)',
  ok: 'var(--color-ok)',
  alert: 'var(--color-alert)',
  neutral: 'var(--color-text-muted)',
  progress: 'var(--color-progress)',
  taken: 'var(--color-taken)',
  ember: 'var(--color-ember)',
}

interface AgendaProps {
  slots: AppointmentSlot[]
  appointments: Appointment[]
  /** Number of days shown from today. */
  days: number
  onSelect: (appointment: Appointment) => void
}

/** F39: week agenda, one column per day, one row per time slot. */
export function AppointmentAgenda({ slots, appointments, days, onSelect }: AgendaProps) {
  const now = useNow()
  const users = useUsersById()
  const serviceName = useServiceName()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
  const times = [...new Set(slots.map((s) => formatTime(s.starts_at)))].sort()
  const slotById = new Map(slots.map((s) => [s.id, s]))
  const today = new Date(now).toDateString()

  return (
    <div className={styles.agenda} style={{ ['--days' as string]: days }} role="grid" aria-label="Agenda des rendez-vous">
      <div className={styles.agendaHead} role="columnheader" aria-label="Heure" />
      {dayKeys.map((d) => (
        <div key={d.toISOString()} role="columnheader" className={[styles.agendaHead, d.toDateString() === today && styles.agendaToday].filter(Boolean).join(' ')}>
          {d.toDateString() === today ? 'Aujourd’hui' : formatDay(d.toISOString())}
        </div>
      ))}
      {times.map((time) => (
        <div key={time} style={{ display: 'contents' }} role="row">
          <div className={styles.agendaTime} role="rowheader">
            {time}
          </div>
          {dayKeys.map((d) => {
            const daySlots = slots.filter((s) => new Date(s.starts_at).toDateString() === d.toDateString() && formatTime(s.starts_at) === time)
            const dayAppointments = appointments.filter((a) => daySlots.some((s) => s.id === a.slot_id))
            const free = daySlots.reduce((sum, s) => sum + s.capacity, 0) - dayAppointments.filter((a) => a.status === 'BOOKED' || a.status === 'COMPLETED').length
            return (
              <div key={d.toISOString()} className={styles.agendaCell} role="gridcell">
                {dayAppointments.map((a) => {
                  const citizen = a.citizen_id ? users.get(a.citizen_id) : undefined
                  const slot = slotById.get(a.slot_id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.appt}
                      style={{ ['--tone' as string]: TONE_VAR[APPOINTMENT_TONE[a.status]] }}
                      onClick={() => onSelect(a)}
                      aria-label={`${time}, ${fullName(citizen)}, ${serviceName(a.service_id)}, ${APPOINTMENT_LABEL[a.status]}`}
                    >
                      <strong>{fullName(citizen)}</strong>
                      <small>
                        {serviceName(a.service_id)} · {APPOINTMENT_LABEL[a.status]}
                        {slot && slot.capacity > 1 ? ` · ${slot.location}` : ''}
                      </small>
                    </button>
                  )
                })}
                {daySlots.length > 0 && free > 0 && <span className={styles.freeSlot}>{free} libre{free > 1 ? 's' : ''}</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
