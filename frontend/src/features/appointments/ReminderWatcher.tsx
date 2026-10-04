import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useAppointment } from '../../api/appointments'
import { http } from '../../api/client'
import { notificationKeys, useMarkRead } from '../../api/notifications'
import { useCitizenSignedIn } from '../../api/session'
import type { NotificationPage } from '../../api/types'
import { useNow } from '../../hooks/useNow'
import { capitalize } from '../../lib/format'
import { Icon } from '../../ui/Icon'
import { countdown, zoneNote } from './appointmentModel'
import styles from './Reminder.module.css'

const REMINDER = 'APPOINTMENT_REMINDER'
const POLL_MS = 30_000

/**
 * F40: the reminder the server sends before an appointment reaches the resident wherever they are in
 * the citizen app (city, chat, console pages, airlock): a card that rings, says when and where, and
 * opens the appointment. When the tab is in the background and the resident allowed it, the browser
 * shows it too. Mounted once, in `FilmLayout`.
 */
export function ReminderWatcher() {
  const signedIn = useCitizenSignedIn()
  const navigate = useNavigate()
  const markRead = useMarkRead()
  const shown = useRef(new Set<number>())
  const unread = useQuery({
    queryKey: [...notificationKeys.all, 'reminders'],
    queryFn: () => http.get<NotificationPage>('/notifications', { params: { unread: true, limit: 20 } }).then((r) => r.data.data),
    enabled: signedIn,
    refetchInterval: POLL_MS,
    // a reminder must not wait for the tab to come back to the front
    refetchIntervalInBackground: true,
  })
  const reminders = (unread.data ?? []).filter((n) => n.type === REMINDER)
  const current = reminders[0] ?? null

  // a reminder arriving while the resident looks elsewhere: the system notification, once per reminder
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    for (const reminder of reminders) {
      if (shown.current.has(reminder.id)) continue
      shown.current.add(reminder.id)
      if (document.visibilityState === 'hidden') new Notification(reminder.title, { body: reminder.body ?? undefined, tag: `rdv-${reminder.id}` })
    }
  }, [reminders])

  if (!signedIn || !current) return null
  const appointmentId = typeof current.data?.appointment_id === 'number' ? current.data.appointment_id : null

  return (
    <ReminderCard
      key={current.id}
      title={current.title}
      body={current.body}
      appointmentId={appointmentId}
      others={reminders.length - 1}
      onDismiss={() => markRead.mutate(current.id)}
      onOpen={() => {
        markRead.mutate(current.id)
        navigate(appointmentId ? `/ville/rendez-vous#rdv-${appointmentId}` : '/ville/rendez-vous')
      }}
    />
  )
}

function ReminderCard({
  title,
  body,
  appointmentId,
  others,
  onDismiss,
  onOpen,
}: {
  title: string
  body: string | null
  appointmentId: number | null
  others: number
  onDismiss: () => void
  onOpen: () => void
}) {
  const now = useNow()
  const lookup = useAppointment(appointmentId)
  const appointment = lookup.data
  const when = appointment?.when
  // a reminder of an appointment cancelled (or removed) since: filed away without being shown
  const stale = appointmentId !== null && (lookup.isError || (appointment !== undefined && appointment.status !== 'BOOKED'))
  const dismissed = useRef(false)
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })
  useEffect(() => {
    if (!stale || dismissed.current) return
    dismissed.current = true
    dismiss.current()
  }, [stale])

  if (stale || (appointmentId !== null && lookup.isPending)) return null

  return (
    <aside className={styles.card} role="alert" aria-labelledby="reminder-title">
      <span className={styles.ring} aria-hidden="true">
        <Icon name="bell" size={22} />
      </span>
      <div className={styles.text}>
        <p className={styles.kicker}>Rappel de rendez-vous{when && ` · ${countdown(when.starts_at, now)}`}</p>
        <p id="reminder-title" className={styles.title}>
          {appointment ? appointment.service.name : title}
        </p>
        {when ? (
          <p className={styles.when}>
            <strong>{capitalize(when.day_label)}</strong>
            <span>
              {when.start_time} → {when.end_time} · {zoneNote(when.time_zone)}
            </span>
            <span>{appointment!.where.location}</span>
          </p>
        ) : (
          body && <p className={styles.body}>{body}</p>
        )}
        {appointment && appointment.preparation.bring.length > 0 && (
          <p className={styles.bring}>
            <Icon name="file" size={14} /> À apporter : {appointment.preparation.bring.join(' · ')}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onOpen}>
            Voir le rendez-vous
          </button>
          <button type="button" className={styles.secondary} onClick={onDismiss}>
            Compris{others > 0 ? ` (${others} autre${others > 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    </aside>
  )
}

/* ─── browser notifications, on request ─────────────────────────────────── */

const permissionListeners = new Set<() => void>()
const readPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/**
 * F40: the resident may also get the reminder from the browser when Nova's tab is in the background.
 * Asked only on a click, never on arrival.
 */
export function BrowserReminderOptIn() {
  const permission = useSyncExternalStore(
    (listener) => {
      permissionListeners.add(listener)
      return () => permissionListeners.delete(listener)
    },
    readPermission,
    () => 'unsupported',
  )
  const [asking, setAsking] = useState(false)

  if (permission === 'unsupported') return null
  if (permission === 'granted')
    return (
      <p className={styles.optIn} data-state="on">
        <Icon name="check" size={14} /> Rappels aussi dans les notifications du navigateur
      </p>
    )
  if (permission === 'denied')
    return <p className={styles.optIn}>Notifications du navigateur bloquées : les rappels restent visibles dans Nova.</p>
  return (
    <button
      type="button"
      className={styles.optInButton}
      disabled={asking}
      onClick={() => {
        setAsking(true)
        void Notification.requestPermission().finally(() => {
          setAsking(false)
          permissionListeners.forEach((listener) => listener())
        })
      }}
    >
      <Icon name="bell" size={15} /> Recevoir aussi les rappels du navigateur
    </button>
  )
}
