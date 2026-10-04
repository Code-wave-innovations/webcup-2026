import { Link } from 'react-router'
import { useAppointments } from '../../api/appointments'
import { useCitizenSignedIn } from '../../api/session'
import { useNow } from '../../hooks/useNow'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Icon } from '../../ui/Icon'
import { countdown } from './appointmentModel'
import styles from './NextAppointment.module.css'

const messages = defineMessages(
  {
    book: 'Prendre rendez-vous avec un agent',
    nextLabel: (service: string, when: string, where: string) => `Prochain rendez-vous : ${service}, ${when}, ${where}`,
    next: (countdown: string) => `Prochain rendez-vous · ${countdown}`,
    at: 'à',
  },
  {
    book: 'Book an appointment with an agent',
    nextLabel: (service, when, where) => `Next appointment: ${service}, ${when}, ${where}`,
    next: (countdown) => `Next appointment · ${countdown}`,
    at: 'at',
  },
)

/**
 * F39 / F40 on the arrival: the resident's next appointment at a glance (when, where, how soon), or
 * the way to book one. Nothing for a demo visitor, who has no account on the API.
 */
export function NextAppointment() {
  const signedIn = useCitizenSignedIn()
  const now = useNow()
  const m = useMessages(messages)
  const locale = useLocale()
  const next = useAppointments({ scope: 'upcoming', status: 'BOOKED', limit: 1 }, signedIn)
  if (!signedIn || next.isPending || next.isError) return null
  const appointment = next.data.data[0]

  if (!appointment) {
    return (
      <Link to="/ville/rendez-vous/nouveau" className={styles.book}>
        <Icon name="calendar" size={16} /> {m.book}
        <Icon name="chevron" size={14} />
      </Link>
    )
  }
  return (
    <Link to={`/ville/rendez-vous#rdv-${appointment.id}`} className={styles.capsule} aria-label={m.nextLabel(appointment.service.name, appointment.when.label, appointment.where.location)}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="calendar" size={18} />
      </span>
      <span className={styles.text}>
        <small>{m.next(countdown(appointment.when.starts_at, now, locale))}</small>
        <strong>
          {appointment.service.name} · {appointment.when.day_label.split(' ').slice(0, 3).join(' ')} {m.at} {appointment.when.start_time}
        </strong>
      </span>
      <Icon name="chevron" size={16} />
    </Link>
  )
}
