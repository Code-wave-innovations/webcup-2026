import { useState, type CSSProperties } from 'react'
import { downloadCalendar, useCancelAppointment, useUpdateReminder } from '../../api/appointments'
import { messageFor } from '../../api/errors'
import type { Appointment } from '../../api/types'
import { capitalize } from '../../lib/format'
import { useNow } from '../../hooks/useNow'
import { Pill } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { countdown, documentsOf, formatCityMoment, REMINDER_OPTIONS, reminderLabel, STATUS, zoneNote } from './appointmentModel'
import styles from './Ticket.module.css'

/** A barcode drawn from the reference: same reference, same bars (decorative) */
function bars(reference: string) {
  return [...reference.replace(/[^A-Z0-9]/gi, '')].flatMap((char) => {
    const code = char.charCodeAt(0)
    return [1 + (code % 3), 1 + ((code >> 2) % 2)]
  })
}

/**
 * F39 / F40: an appointment as a ticket. The stub holds the reference; the body says when (the city's
 * day and hours, in full), where, with whom, when the reminder goes, and what to prepare (a list the
 * resident can tick while getting ready). `manage` adds the reminder change and the cancellation.
 */
export function AppointmentTicket({ appointment, printed, manage }: { appointment: Appointment; printed?: boolean; manage?: boolean }) {
  const now = useNow()
  const { when, where, preparation, reminder } = appointment
  const status = STATUS[appointment.status]
  const upcoming = Date.parse(when.starts_at) > now
  const live = appointment.status === 'BOOKED' && upcoming
  const documents = [...new Set([...preparation.bring, ...documentsOf(preparation.required_documents)])]
  const [ticked, setTicked] = useState<string[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)

  const reminderLine =
    reminder.offset_minutes === null
      ? 'Aucun rappel'
      : reminder.sent_at
        ? `${reminderLabel(reminder.offset_minutes)} · envoyé ${formatCityMoment(reminder.sent_at, when.time_zone)}`
        : `${reminderLabel(reminder.offset_minutes)} · prévu ${formatCityMoment(reminder.scheduled_for!, when.time_zone)}`

  return (
    <article
      className={[styles.ticket, printed && styles.printed].filter(Boolean).join(' ')}
      data-status={appointment.status}
      aria-labelledby={`ticket-${appointment.id}`}
      id={`rdv-${appointment.id}`}
    >
      <div className={styles.stub}>
        <Pill tone={status.tone}>{status.label}</Pill>
        <p className={styles.label}>Référence</p>
        <p className={styles.reference}>{appointment.reference}</p>
        <span className={styles.barcode} aria-hidden="true">
          {bars(appointment.reference).map((w, i) => (
            <i key={i} style={{ '--w': w } as CSSProperties} />
          ))}
        </span>
        {live && <p className={styles.countdown}>{countdown(when.starts_at, now)}</p>}
      </div>

      <div className={styles.body}>
        <p className={styles.kicker}>Rendez-vous · {appointment.service.name}</p>
        <h3 id={`ticket-${appointment.id}`} className={styles.day}>
          {capitalize(when.day_label)}
        </h3>
        <p className={styles.time}>
          <span>{when.start_time}</span>
          <Icon name="chevron" size={22} />
          <span>{when.end_time}</span>
          <small>
            {when.duration_minutes} min · {zoneNote(when.time_zone)}
          </small>
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>
              <Icon name="pin" size={14} /> Où
            </dt>
            <dd>
              {where.location}
              {where.service_address && <small>{where.service_address}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="face" size={14} /> Avec
            </dt>
            <dd>{appointment.with ?? 'Un agent du service'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="file" size={14} /> Objet
            </dt>
            <dd>
              {appointment.reason}
              {appointment.procedure && <small>Démarche : {appointment.procedure.title}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="bell" size={14} /> Rappel
            </dt>
            <dd>{reminderLine}</dd>
          </div>
        </dl>

        {appointment.status !== 'CANCELLED' && (
          <section className={styles.prepare} aria-label="À préparer">
            <p className={styles.label}>À préparer</p>
            {preparation.notes && <p className={styles.notes}>{preparation.notes}</p>}
            <ul>
              {documents.map((item) => (
                <li key={item}>
                  <label data-ticked={ticked.includes(item) || undefined}>
                    <input type="checkbox" checked={ticked.includes(item)} onChange={() => setTicked((list) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]))} />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
            {(preparation.contact.phone || preparation.contact.email) && (
              <p className={styles.contact}>
                Un empêchement, une question ?{' '}
                {preparation.contact.phone && <a href={`tel:${preparation.contact.phone.replace(/[^\d+]/g, '')}`}>{preparation.contact.phone}</a>}
                {preparation.contact.phone && preparation.contact.email && ' · '}
                {preparation.contact.email && <a href={`mailto:${preparation.contact.email}`}>{preparation.contact.email}</a>}
              </p>
            )}
          </section>
        )}

        {live && (
          <div className={styles.actions}>
            <Button
              variant="ghost"
              small
              onClick={() => {
                setCalendarError(null)
                downloadCalendar(appointment).catch((error) => setCalendarError(messageFor(error)))
              }}
            >
              <Icon name="calendar" size={16} /> Ajouter à mon agenda
            </Button>
            {manage && <ReminderControl appointment={appointment} />}
            {manage && <CancelControl appointment={appointment} />}
          </div>
        )}
        {calendarError && <p className={styles.error}>{calendarError}</p>}
      </div>
    </article>
  )
}

/** F40: change when to be reminded (or not at all); a reminder already sent is planned again */
function ReminderControl({ appointment }: { appointment: Appointment }) {
  const update = useUpdateReminder()
  return (
    <label className={styles.reminderControl}>
      <Icon name="bell" size={15} />
      <span className={styles.srOnly}>Rappel</span>
      <select
        value={appointment.reminder.offset_minutes ?? ''}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ id: appointment.id, offset: e.target.value === '' ? null : Number(e.target.value) })}
        aria-describedby={update.isError ? `reminder-error-${appointment.id}` : undefined}
      >
        {REMINDER_OPTIONS.map((o) => (
          <option key={String(o.value)} value={o.value ?? ''}>
            {o.label}
          </option>
        ))}
      </select>
      {update.isError && (
        <span id={`reminder-error-${appointment.id}`} className={styles.error}>
          {messageFor(update.error)}
        </span>
      )}
    </label>
  )
}

function CancelControl({ appointment }: { appointment: Appointment }) {
  const cancel = useCancelAppointment()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')

  if (!asking) {
    return (
      <Button variant="ghost" small onClick={() => setAsking(true)}>
        <Icon name="close" size={15} /> Annuler
      </Button>
    )
  }
  return (
    <div className={styles.cancel} role="group" aria-label="Annuler le rendez-vous">
      <p>
        Annuler le rendez-vous du {appointment.when.day_label} à {appointment.when.start_time} ? Le créneau sera libéré pour un autre habitant et aucun rappel ne sera envoyé.
      </p>
      <label>
        <span>Motif (facultatif, transmis à l’agent)</span>
        <input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </label>
      {cancel.isError && <p className={styles.error}>{messageFor(cancel.error)}</p>}
      <div className={styles.cancelActions}>
        <Button small onClick={() => cancel.mutate({ id: appointment.id, reason: reason.trim() || undefined })} disabled={cancel.isPending}>
          Confirmer l’annulation
        </Button>
        <Button variant="ghost" small onClick={() => setAsking(false)}>
          Garder mon rendez-vous
        </Button>
      </div>
    </div>
  )
}
