import { useEffect, useRef } from 'react'
import { Pill, Plate } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { STATUSES, signalForStatus, urgencyLabel } from './reportModel'
import { useReportStore, type TrackedReport } from './reportStore'
import styles from './ReportPanel.module.css'

/** Where the report stands. The status comes from the API; nothing here advances it by hand. */
export function ReportTracker({ report }: { report: TrackedReport }) {
  const reset = useReportStore((s) => s.reset)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const step = signalForStatus(report.status)
  const refused = report.status === 'REJECTED'
  const resolved = step.index === 3 && !refused

  useEffect(() => {
    titleRef.current?.focus()
  }, [report.id])

  const copy = () => {
    void navigator.clipboard.writeText(report.code).then(
      () => announce('Référence copiée'),
      () => announce('Sélectionnez la référence pour la copier'),
    )
  }

  return (
    <>
      <div className={styles.line}>
        <Plate>{report.code}</Plate>
        <Pill tone={step.tone}>{step.name}</Pill>
      </div>
      <h3 ref={titleRef} tabIndex={-1}>
        Demande envoyée
      </h3>
      <p className={styles.confirm} role="status">
        {report.confirmation}
      </p>
      <p className={text.note}>
        {report.title}. {report.location}
        {report.districtName ? `, ${report.districtName}` : ''}. {report.category}, urgence estimée {urgencyLabel(report.urgency).toLowerCase()}.
      </p>
      {refused ? (
        <p className={text.note}>Ce signalement a été refusé. Le motif est dans le message du service.</p>
      ) : (
        <ol className={[styles.timeline, resolved && styles.resolved].filter(Boolean).join(' ')}>
          {STATUSES.map((item, i) => {
            const state = i < step.index || resolved ? 'done' : i === step.index ? 'current' : 'upcoming'
            return (
              <li key={item.name} className={styles[state]} aria-current={i === step.index ? 'step' : undefined}>
                <span className={styles.rail}>
                  <span className={styles.station}>{state === 'done' && <Icon name="check" size={13} stroke={3} />}</span>
                  {i < STATUSES.length - 1 && <span className={styles.track} />}
                </span>
                <span className={styles.step}>
                  <b>{i === step.index ? step.name : item.name}</b>
                  <span className={text.note}>{i <= step.index ? item.note : 'À venir.'}</span>
                </span>
                <span className={styles.time}>{i === 0 ? report.receivedAt : ''}</span>
              </li>
            )
          })}
        </ol>
      )}
      <div className={styles.geo}>
        <Button type="button" variant="ghost" small onClick={copy}>
          Copier la référence
        </Button>
        <Button type="button" variant="ghost" small onClick={reset}>
          Signaler autre chose
        </Button>
      </div>
    </>
  )
}
