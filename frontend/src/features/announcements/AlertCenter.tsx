import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useActiveAlerts } from '../../api/alerts'
import { useCitizenSessionStore } from '../../api/session'
import type { ActiveAlert } from '../../api/types'
import { useDirectorStore } from '../../experience/director/directorStore'
import { Icon } from '../../ui/Icon'
import { useAuthStore } from '../auth/authStore'
import { criticalAlertOf, useAlertFeed } from './alertFeedStore'
import { pendingTransmissions, SEVERITY, SEVERITY_ICON, stepsOf, zoneLabel } from './alertModel'
import { bindCityAlertSound } from './alertSound'
import { AlertTransmission } from './AlertTransmission'
import styles from './AlertCenter.module.css'

/** setTimeout holds at most ~24.8 days */
const MAX_TIMER_MS = 2_147_000_000

/**
 * D18 / F29 / F31: the High Council's channel on every screen of the citizen app, the airlock included.
 * A new message that concerns the resident takes over the screen (`AlertTransmission`); once read, it
 * stays in the banner until it ends. A critical one turns the city red and keeps its chime.
 */
export function AlertCenter() {
  const film = useAuthStore((s) => s.session)
  const citizenToken = useCitizenSessionStore((s) => s.token)
  const token = citizenToken ?? film?.token
  const cinematic = useDirectorStore((s) => s.cinematic)
  const { pathname } = useLocation()
  const feed = useActiveAlerts(token)
  const { refetch } = feed
  const alerts = useAlertFeed((s) => s.alerts)
  const acknowledged = useAlertFeed((s) => s.acknowledged)
  const dismissed = useAlertFeed((s) => s.dismissed)
  const reviewing = useAlertFeed((s) => s.reviewing)
  const { receive, acknowledge, dismiss, review } = useAlertFeed.getState()

  useEffect(() => {
    if (feed.data) receive(feed.data)
  }, [feed.data, receive])

  // the city turns red (and the chime plays) while a critical alert concerns me
  const criticalId = criticalAlertOf(alerts)?.id ?? null
  useEffect(() => {
    useDirectorStore.getState().setAlert(criticalId !== null)
  }, [criticalId])
  useEffect(() => bindCityAlertSound(), [])

  // "visible at the right time": an alert that ends between two refreshes leaves at its hour
  useEffect(() => {
    const ends = alerts.flatMap((a) => (a.ends_at ? [Date.parse(a.ends_at)] : []))
    if (ends.length === 0) return
    const timer = setTimeout(() => void refetch(), Math.min(Math.max(0, Math.min(...ends) - Date.now()) + 500, MAX_TIMER_MS))
    return () => clearTimeout(timer)
  }, [alerts, refetch])

  const reviewed = reviewing === null ? undefined : alerts.find((a) => a.id === reviewing)
  // nothing takes over the screen during the film's entry; it comes right after
  const queue = reviewed ? [reviewed] : cinematic ? [] : pendingTransmissions(alerts, acknowledged)
  const mine = alerts.filter((a) => a.concerns_me && acknowledged.includes(a.id))

  return (
    <>
      <AlertTicker alerts={mine} dismissed={dismissed} airlock={pathname === '/'} onOpen={review} onDismiss={dismiss} />
      {queue.length > 0 && <AlertTransmission alerts={queue} review={reviewed !== undefined} onAcknowledge={acknowledge} />}
    </>
  )
}

/**
 * The read alerts that still concern me, one at a time. A critical one cannot be folded away
 * (the plan's "reduced banner"); the others can, and stay folded for this alert.
 */
function AlertTicker({
  alerts,
  dismissed,
  airlock,
  onOpen,
  onDismiss,
}: {
  alerts: ActiveAlert[]
  dismissed: number[]
  airlock: boolean
  onOpen: (id: number) => void
  onDismiss: (id: number) => void
}) {
  const [index, setIndex] = useState(0)
  const visible = alerts.filter((a) => a.severity === 'CRITICAL' || !dismissed.includes(a.id))
  if (visible.length === 0) return null

  const position = index % visible.length
  const alert = visible[position]
  const firstStep = stepsOf(alert.instructions)[0] ?? alert.message
  const step = (delta: number) => setIndex((position + delta + visible.length) % visible.length)

  return (
    <aside className={styles.ticker} data-severity={alert.severity} data-airlock={airlock || undefined} aria-label="Alertes en cours">
      <span className={styles.beacon} aria-hidden="true">
        <Icon name={SEVERITY_ICON[alert.severity]} size={18} />
      </span>
      <div className={styles.text} aria-live="polite">
        <p className={styles.line}>
          <strong className={styles.level}>{SEVERITY[alert.severity].label}</strong>
          <span className={styles.title}>{alert.title}</span>
          {alert.audience !== 'ALL' && <span className={styles.zone}>{zoneLabel(alert)}</span>}
        </p>
        <p className={styles.todo}>{firstStep}</p>
      </div>
      {visible.length > 1 && (
        <div className={styles.pager}>
          <button type="button" onClick={() => step(-1)} aria-label="Alerte précédente">
            <Icon name="back" size={14} />
          </button>
          <span>
            {position + 1}/{visible.length}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Alerte suivante">
            <Icon name="chevron" size={14} />
          </button>
        </div>
      )}
      <button type="button" className={styles.open} onClick={() => onOpen(alert.id)}>
        Voir les consignes
      </button>
      {alert.severity !== 'CRITICAL' && (
        <button type="button" className={styles.hide} onClick={() => onDismiss(alert.id)} aria-label={`Masquer l'alerte « ${alert.title} »`}>
          <Icon name="close" size={16} />
        </button>
      )}
    </aside>
  )
}
