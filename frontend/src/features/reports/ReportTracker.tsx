import { Pill, Plate } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { RESOLVED, STATUSES, type Report } from './reportModel'
import { useReportStore } from './reportStore'
import styles from './ReportPanel.module.css'

/** Where the report stands, on a four-station lifeline. */
export function ReportTracker({ report }: { report: Report }) {
  const fromApi = useReportStore((s) => s.fromApi)
  const { advance, reset } = useReportStore.getState()
  const status = STATUSES[report.status]
  const resolved = report.status === RESOLVED

  return (
    <>
      <div className={styles.line}>
        <Plate>{report.code}</Plate>
        <Pill tone={status.tone}>{status.name}</Pill>
      </div>
      <h3>{report.title}</h3>
      <p className={text.note}>
        {report.sector}, {report.category.toLowerCase()}, urgence {report.urgency.toLowerCase()}
      </p>
      <ol className={[styles.timeline, resolved && styles.resolved].filter(Boolean).join(' ')}>
        {STATUSES.map((step, i) => {
          const state = i < report.status || resolved ? 'done' : i === report.status ? 'current' : 'upcoming'
          return (
            <li key={step.name} className={styles[state]} aria-current={i === report.status ? 'step' : undefined}>
              <span className={styles.rail}>
                <span className={styles.station}>{state === 'done' && <Icon name="check" size={13} stroke={3} />}</span>
                {i < STATUSES.length - 1 && <span className={styles.track} />}
              </span>
              <span className={styles.step}>
                <b>{step.name}</b>
                <span className={text.note}>{i <= report.status ? step.note : 'À venir.'}</span>
              </span>
              <span className={styles.time}>{report.times[i] ?? ''}</span>
            </li>
          )
        })}
      </ol>
      {fromApi ? (
        <Button variant="ghost" small onClick={reset}>
          Signaler autre chose
        </Button>
      ) : resolved ? (
        <Button variant="ghost" small onClick={reset}>
          Signaler autre chose
        </Button>
      ) : (
        <Button variant="ghost" small onClick={advance}>
          Faire avancer la démonstration
        </Button>
      )}
    </>
  )
}
