import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { isLightScene } from '../../a11y/sceneMode'
import { barePath } from '../../a11y/scenePaths'
import { useActiveAlerts, useNextAlertStart } from '../../api/alerts'
import { useCitizenSessionStore } from '../../api/session'
import { useBodyClass } from '../../hooks/useBodyClass'
import type { ActiveAlert } from '../../api/types'
import { useDirectorStore } from '../../experience/director/directorStore'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Icon } from '../../ui/Icon'
import { useAuthStore } from '../auth/authStore'
import { criticalAlertOf, useAlertFeed } from './alertFeedStore'
import { alertWakeMs, pendingTransmissions, SEVERITY_ICON, severityLabel, stepsOf, zoneLabel } from './alertModel'
import { bindCityAlertSound } from './alertSound'
import { AlertTransmission } from './AlertTransmission'
import styles from './AlertCenter.module.css'

const messages = defineMessages(
  {
    current: 'Alertes en cours',
    previous: 'Alerte précédente',
    next: 'Alerte suivante',
    instructions: 'Voir les consignes',
    hide: (title: string) => `Masquer l'alerte « ${title} »`,
  },
  {
    current: 'Current alerts',
    previous: 'Previous alert',
    next: 'Next alert',
    instructions: 'See the instructions',
    hide: (title) => `Hide the alert “${title}”`,
  },
)

/**
 * D18 / F29 / F31: the High Council's channel on every screen of the citizen app, the airlock included.
 * A new message that concerns the resident takes over the screen (`AlertTransmission`); once read, it
 * stays in the banner until it ends. A critical one turns the city red and keeps its chime.
 */
export function AlertCenter() {
  const citizenToken = useCitizenSessionStore((s) => s.token)
  const film = useAuthStore((s) => s.session)
  const token = citizenToken ?? film?.token
  const cinematic = useDirectorStore((s) => s.cinematic)
  const { pathname } = useLocation()
  const feed = useActiveAlerts(token)
  const nextStart = useNextAlertStart().data
  const { refetch } = feed
  const alerts = useAlertFeed((s) => s.alerts)
  const acknowledged = useAlertFeed((s) => s.acknowledged)
  const dismissed = useAlertFeed((s) => s.dismissed)
  const reviewing = useAlertFeed((s) => s.reviewing)
  const { receive, acknowledge, dismiss, review } = useAlertFeed.getState()

  useEffect(() => {
    if (Array.isArray(feed.data)) receive(feed.data)
  }, [feed.data, receive])

  // the city turns red (and the chime plays) while a critical alert concerns me. The light version has neither.
  const criticalId = criticalAlertOf(alerts)?.id ?? null
  useEffect(() => {
    if (!isLightScene) useDirectorStore.getState().setAlert(criticalId !== null)
  }, [criticalId])
  useEffect(() => (isLightScene ? undefined : bindCityAlertSound()), [])

  // Visible at the start hour, and gone at the end hour, without waiting for the next poll.
  useEffect(() => {
    const moments = [...alerts.flatMap((a) => (a.ends_at ? [Date.parse(a.ends_at)] : [])), ...(nextStart ? [Date.parse(nextStart)] : [])]
    const wait = alertWakeMs(Date.now(), moments)
    if (wait === null) return
    const timer = setTimeout(() => void refetch(), wait)
    return () => clearTimeout(timer)
  }, [alerts, nextStart, refetch])

  const reviewed = reviewing === null ? undefined : alerts.find((a) => a.id === reviewing)
  // nothing takes over the screen during the film's entry; it comes right after
  const queue = reviewed ? [reviewed] : cinematic ? [] : pendingTransmissions(alerts, acknowledged)
  const mine = alerts.filter((a) => a.concerns_me && acknowledged.includes(a.id))

  return (
    <>
      <AlertTicker alerts={mine} dismissed={dismissed} airlock={barePath(pathname) === '/'} onOpen={review} onDismiss={dismiss} />
      {queue.length > 0 && <AlertTransmission alerts={queue} review={reviewed !== undefined} onAcknowledge={acknowledge} />}
    </>
  )
}

/**
 * The read alerts that still concern me, one at a time. The cross folds the current one away
 * for this browser, including a critical alert, until that alert ends.
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
  const m = useMessages(messages)
  const locale = useLocale()
  const visible = alerts.filter((a) => a.severity === 'CRITICAL' || !dismissed.includes(a.id))
  // pages that start at the top (console pages) leave room for the banner while it shows
  useBodyClass('has-alert-ticker', visible.length > 0)
  if (visible.length === 0) return null

  const position = index % visible.length
  const alert = visible[position]
  const firstStep = stepsOf(alert.instructions)[0] ?? alert.message
  const zone = zoneLabel(alert, locale)
  const step = (delta: number) => setIndex((position + delta + visible.length) % visible.length)

  return (
    <aside className={styles.ticker} data-severity={alert.severity} data-airlock={airlock || undefined} aria-label={m.current}>
      <span className={styles.beacon} aria-hidden="true">
        <Icon name={SEVERITY_ICON[alert.severity]} size={18} />
      </span>
      <div className={styles.text} aria-live="polite">
        <p className={styles.line}>
          <strong className={styles.level}>{severityLabel(alert.severity, locale)}</strong>
          <span className={styles.title}>{alert.title}</span>
          {alert.audience !== 'ALL' && <span className={styles.zone}>{zone}</span>}
        </p>
        <p className={styles.todo}>{firstStep}</p>
      </div>
      {visible.length > 1 && (
        <div className={styles.pager}>
          <button type="button" onClick={() => step(-1)} aria-label={m.previous}>
            <Icon name="back" size={14} />
          </button>
          <span>
            {position + 1}/{visible.length}
          </span>
          <button type="button" onClick={() => step(1)} aria-label={m.next}>
            <Icon name="chevron" size={14} />
          </button>
        </div>
      )}
      <button type="button" className={styles.open} onClick={() => onOpen(alert.id)}>
        {m.instructions}
      </button>
      {alert.severity !== 'CRITICAL' && (
        <button type="button" className={styles.hide} onClick={() => onDismiss(alert.id)} aria-label={m.hide(alert.title)}>
          <Icon name="close" size={16} />
        </button>
      )}
    </aside>
  )
}
