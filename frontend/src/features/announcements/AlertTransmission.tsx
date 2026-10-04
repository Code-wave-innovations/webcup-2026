import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { ActiveAlert } from '../../api/types'
import { holdSmoothScroll } from '../../app/smoothScroll'
import { useNow } from '../../hooks/useNow'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Icon } from '../../ui/Icon'
import { useTypewriter } from '../../ui/useTypewriter'
import { formatWhen, periodOf, recommendationsOf, SEVERITY, SEVERITY_ICON, stepsOf, zoneLabel } from './alertModel'
import styles from './AlertTransmission.module.css'

/** The card leaves before the next one comes in; the whole transmission folds after the last one */
const CARD_OUT_MS = 380
const FOLD_MS = 520

/**
 * D18: a message of the High Council takes over the screen the moment it concerns the resident. The
 * signal comes in, the card unfolds, and what to do is set out step by step; « J'ai compris » files it
 * away into the banner. Several messages queue up, the most serious first.
 */
export function AlertTransmission({ alerts, review, onAcknowledge }: { alerts: ActiveAlert[]; review: boolean; onAcknowledge: (id: number) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [leaving, setLeaving] = useState<'card' | 'all' | null>(null)
  const reduced = useReducedMotion()
  const alert = alerts[0]
  const waiting = alerts.length - 1

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // the flyover must not move under the message
    holdSmoothScroll(true)
    return () => {
      holdSmoothScroll(false)
      clearTimeout(timer.current)
    }
  }, [])

  const acknowledge = () => {
    if (leaving) return
    const id = alert.id
    if (reduced) return onAcknowledge(id)
    const last = alerts.length === 1
    setLeaving(last ? 'all' : 'card')
    timer.current = setTimeout(
      () => {
        setLeaving(null)
        onAcknowledge(id)
      },
      last ? FOLD_MS : CARD_OUT_MS,
    )
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={[styles.dialog, leaving === 'all' && styles.folding].filter(Boolean).join(' ')}
      data-severity={alert.severity}
      role="alertdialog"
      data-lenis-prevent
      aria-labelledby={`transmission-${alert.id}-title`}
      aria-describedby={`transmission-${alert.id}-todo`}
      onCancel={(event) => {
        event.preventDefault()
        acknowledge()
      }}
    >
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.rings} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <TransmissionCard key={alert.id} alert={alert} leaving={leaving === 'card'} review={review} waiting={waiting} onAcknowledge={acknowledge} />
    </dialog>,
    document.body,
  )
}

function TransmissionCard({
  alert,
  leaving,
  review,
  waiting,
  onAcknowledge,
}: {
  alert: ActiveAlert
  leaving: boolean
  review: boolean
  waiting: number
  onAcknowledge: () => void
}) {
  const now = useNow()
  const title = useTypewriter(alert.title)
  const steps = stepsOf(alert.instructions)
  const recommendations = recommendationsOf(alert)
  const titleId = `transmission-${alert.id}-title`
  const todoId = `transmission-${alert.id}-todo`
  const targeted = alert.audience !== 'ALL' && alert.concerns_me
  const source = alert.source ?? 'Haut Conseil de la Ville'
  const label = useId()

  return (
    <article className={[styles.card, leaving && styles.cardOut].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <span className={`${styles.corner} ${styles.cornerA}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerB}`} aria-hidden="true" />
      <span className={styles.scan} aria-hidden="true" />

      <header className={styles.signal}>
        <span className={styles.wave} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
        <span className={styles.channel}>
          <Icon name="broadcast" size={16} />
          Transmission prioritaire
          <b>{source}</b>
        </span>
        <span className={styles.stamp}>Émis à {formatWhen(alert.starts_at, now)}</span>
      </header>

      <div className={styles.head}>
        <div className={styles.emblem} aria-hidden="true">
          <span className={styles.emblemHex}>
            <Icon name={SEVERITY_ICON[alert.severity]} size={34} stroke={1.8} />
          </span>
        </div>
        <div className={styles.headText}>
          <p className={styles.tags}>
            <span className={styles.level}>
              <Icon name={SEVERITY_ICON[alert.severity]} size={15} />
              {SEVERITY[alert.severity].label}
            </span>
            <span className={styles.zone}>
              <Icon name="pin" size={14} />
              {zoneLabel(alert)}
            </span>
            {targeted && <span className={styles.me}>Vous êtes concerné·e</span>}
          </p>
          <h2 id={titleId} className={styles.title} aria-label={alert.title}>
            <span aria-hidden="true">{title}</span>
            <i className={styles.caret} aria-hidden="true" />
          </h2>
          <p className={styles.message}>{alert.message}</p>
        </div>
      </div>

      <div className={styles.body}>
        {steps.length > 0 ? (
          <section className={styles.todo} id={todoId} aria-labelledby={`${label}-todo`}>
            <h3 id={`${label}-todo`}>Ce que vous devez faire</h3>
            <ol>
              {steps.map((step, i) => (
                <li key={step} style={{ '--i': i } as CSSProperties}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ) : (
          // the dialog is described by what to do; without instructions, by the message itself
          <p id={todoId} className={styles.srOnly}>
            {alert.message}
          </p>
        )}

        {recommendations.length > 0 && (
          <section className={styles.recos} aria-labelledby={`${label}-recos`}>
            <h3 id={`${label}-recos`}>Recommandations</h3>
            <ul>
              {recommendations.map((r, i) => (
                <li key={`${r.title}-${r.text}`} style={{ '--i': i } as CSSProperties}>
                  {r.title && <strong>{r.title}</strong>}
                  <p>{r.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className={styles.foot}>
        <p className={styles.period}>
          <Icon name="clock" size={15} />
          {periodOf(alert, now)}
        </p>
        {waiting > 0 && (
          <p className={styles.queue}>
            {waiting === 1 ? '1 autre message en attente' : `${waiting} autres messages en attente`}
          </p>
        )}
        <button type="button" className={styles.ack} onClick={onAcknowledge} autoFocus>
          <Icon name="check" size={18} />
          {review ? 'Fermer' : waiting > 0 ? "J'ai compris · suivant" : "J'ai compris"}
        </button>
      </footer>
    </article>
  )
}
