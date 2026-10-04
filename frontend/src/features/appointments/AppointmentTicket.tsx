import { useState, type CSSProperties } from 'react'
import { downloadCalendar, useCancelAppointment, useUpdateReminder } from '../../api/appointments'
import { messageFor } from '../../api/errors'
import type { Appointment } from '../../api/types'
import { defineMessages, localeTag, useLocale, useMessages } from '../../i18n'
import { capitalize } from '../../lib/format'
import { useNow } from '../../hooks/useNow'
import { Pill } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { countdown, documentsOf, formatCityMoment, reminderLabel, reminderOptions, statusView, zoneNote } from './appointmentModel'
import styles from './Ticket.module.css'

const messages = defineMessages(
  {
    noReminder: 'Aucun rappel',
    sent: (label: string, moment: string) => `${label} · envoyé ${moment}`,
    planned: (label: string, moment: string) => `${label} · prévu ${moment}`,
    reference: 'Référence',
    kicker: (service: string) => `Rendez-vous · ${service}`,
    where: 'Où',
    with: 'Avec',
    anAgent: 'Un agent du service',
    subject: 'Objet',
    procedure: (title: string) => `Démarche : ${title}`,
    reminder: 'Rappel',
    prepare: 'À préparer',
    question: 'Un empêchement, une question ?',
    addToCalendar: 'Ajouter à mon agenda',
    cancel: 'Annuler',
    cancelGroup: 'Annuler le rendez-vous',
    cancelAsk: (day: string, time: string) =>
      `Annuler le rendez-vous du ${day} à ${time} ? Le créneau sera libéré pour un autre habitant et aucun rappel ne sera envoyé.`,
    cancelReason: 'Motif (facultatif, transmis à l’agent)',
    confirmCancel: 'Confirmer l’annulation',
    keep: 'Garder mon rendez-vous',
  },
  {
    noReminder: 'No reminder',
    sent: (label, moment) => `${label} · sent ${moment}`,
    planned: (label, moment) => `${label} · planned ${moment}`,
    reference: 'Reference',
    kicker: (service) => `Appointment · ${service}`,
    where: 'Where',
    with: 'With',
    anAgent: 'An agent of the service',
    subject: 'Subject',
    procedure: (title) => `Procedure: ${title}`,
    reminder: 'Reminder',
    prepare: 'To prepare',
    question: 'Can’t make it, or a question?',
    addToCalendar: 'Add to my calendar',
    cancel: 'Cancel',
    cancelGroup: 'Cancel the appointment',
    cancelAsk: (day, time) => `Cancel the appointment on ${day} at ${time}? The slot will be freed for another resident and no reminder will be sent.`,
    cancelReason: 'Reason (optional, passed on to the agent)',
    confirmCancel: 'Confirm the cancellation',
    keep: 'Keep my appointment',
  },
)

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
  const m = useMessages(messages)
  const locale = useLocale()
  const { when, where, preparation, reminder } = appointment
  const status = statusView(appointment.status, locale)
  const upcoming = Date.parse(when.starts_at) > now
  const live = appointment.status === 'BOOKED' && upcoming
  const documents = [...new Set([...preparation.bring, ...documentsOf(preparation.required_documents)])]
  const [ticked, setTicked] = useState<string[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)

  const reminderLine =
    reminder.offset_minutes === null
      ? m.noReminder
      : reminder.sent_at
        ? m.sent(reminderLabel(reminder.offset_minutes, locale), formatCityMoment(reminder.sent_at, when.time_zone, locale))
        : m.planned(reminderLabel(reminder.offset_minutes, locale), formatCityMoment(reminder.scheduled_for!, when.time_zone, locale))

  return (
    <article
      className={[styles.ticket, printed && styles.printed].filter(Boolean).join(' ')}
      data-status={appointment.status}
      data-stamp={status.label.toLocaleUpperCase(localeTag(locale))}
      aria-labelledby={`ticket-${appointment.id}`}
      id={`rdv-${appointment.id}`}
    >
      <div className={styles.stub}>
        <Pill tone={status.tone}>{status.label}</Pill>
        <p className={styles.label}>{m.reference}</p>
        <p className={styles.reference}>{appointment.reference}</p>
        <span className={styles.barcode} aria-hidden="true">
          {bars(appointment.reference).map((w, i) => (
            <i key={i} style={{ '--w': w } as CSSProperties} />
          ))}
        </span>
        {live && <p className={styles.countdown}>{countdown(when.starts_at, now, locale)}</p>}
      </div>

      <div className={styles.body}>
        <p className={styles.kicker}>{m.kicker(appointment.service.name)}</p>
        <h3 id={`ticket-${appointment.id}`} className={styles.day}>
          {capitalize(when.day_label)}
        </h3>
        <p className={styles.time}>
          <span>{when.start_time}</span>
          <Icon name="chevron" size={22} />
          <span>{when.end_time}</span>
          <small>
            {when.duration_minutes} min · {zoneNote(when.time_zone, locale)}
          </small>
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>
              <Icon name="pin" size={14} /> {m.where}
            </dt>
            <dd>
              {where.location}
              {where.service_address && <small>{where.service_address}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="face" size={14} /> {m.with}
            </dt>
            <dd>{appointment.with ?? m.anAgent}</dd>
          </div>
          <div>
            <dt>
              <Icon name="file" size={14} /> {m.subject}
            </dt>
            <dd>
              {appointment.reason}
              {appointment.procedure && <small>{m.procedure(appointment.procedure.title)}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="bell" size={14} /> {m.reminder}
            </dt>
            <dd>{reminderLine}</dd>
          </div>
        </dl>

        {appointment.status !== 'CANCELLED' && (
          <section className={styles.prepare} aria-label={m.prepare}>
            <p className={styles.label}>{m.prepare}</p>
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
                {m.question}{' '}
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
              <Icon name="calendar" size={16} /> {m.addToCalendar}
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
  const m = useMessages(messages)
  const locale = useLocale()
  return (
    <label className={styles.reminderControl}>
      <Icon name="bell" size={15} />
      <span className={styles.srOnly}>{m.reminder}</span>
      <select
        value={appointment.reminder.offset_minutes ?? ''}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ id: appointment.id, offset: e.target.value === '' ? null : Number(e.target.value) })}
        aria-describedby={update.isError ? `reminder-error-${appointment.id}` : undefined}
      >
        {reminderOptions(locale).map((o) => (
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
  const m = useMessages(messages)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')

  if (!asking) {
    return (
      <Button variant="ghost" small onClick={() => setAsking(true)}>
        <Icon name="close" size={15} /> {m.cancel}
      </Button>
    )
  }
  return (
    <div className={styles.cancel} role="group" aria-label={m.cancelGroup}>
      <p>{m.cancelAsk(appointment.when.day_label, appointment.when.start_time)}</p>
      <label>
        <span>{m.cancelReason}</span>
        <input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </label>
      {cancel.isError && <p className={styles.error}>{messageFor(cancel.error)}</p>}
      <div className={styles.cancelActions}>
        <Button small onClick={() => cancel.mutate({ id: appointment.id, reason: reason.trim() || undefined })} disabled={cancel.isPending}>
          {m.confirmCancel}
        </Button>
        <Button variant="ghost" small onClick={() => setAsking(false)}>
          {m.keep}
        </Button>
      </div>
    </div>
  )
}
