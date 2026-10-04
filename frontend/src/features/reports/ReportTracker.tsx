import { useEffect, useRef } from 'react'
import { defineMessages, messagesFor, useLocale } from '../../i18n'
import { Pill, Plate } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { categoryLabel, reportSteps, signalForStatus, urgencyLabel } from './reportModel'
import { useReportStore, type TrackedReport } from './reportStore'
import styles from './ReportPanel.module.css'

const messages = defineMessages(
  {
    copied: 'Référence copiée',
    selectToCopy: 'Sélectionnez la référence pour la copier',
    title: 'Demande envoyée',
    stale: 'Dernier état connu. La référence reste valable ; le suivi reprend au retour du réseau.',
    positionSent: 'Position envoyée',
    summary: (category: string, urgency: string) => `${category}, urgence estimée ${urgency.toLowerCase()}.`,
    refused: 'Ce signalement a été refusé. Le motif est dans le message du service.',
    upcoming: 'À venir.',
    copy: 'Copier la référence',
    another: 'Signaler autre chose',
  },
  {
    copied: 'Reference copied',
    selectToCopy: 'Select the reference to copy it',
    title: 'Request sent',
    stale: 'Last known status. The reference is still valid; tracking resumes when the network is back.',
    positionSent: 'Position sent',
    summary: (category, urgency) => `${category}, estimated urgency ${urgency.toLowerCase()}.`,
    refused: 'This report was declined. The reason is in the service’s message.',
    upcoming: 'Coming up.',
    copy: 'Copy the reference',
    another: 'Report something else',
  },
)

/** Where the report stands. The status comes from the API; nothing here advances it by hand. */
export function ReportTracker({ report, stale = false }: { report: TrackedReport; stale?: boolean }) {
  const reset = useReportStore((s) => s.reset)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const locale = useLocale()
  const m = messagesFor(messages, locale)
  const steps = reportSteps(locale)
  const step = signalForStatus(report.status, locale)
  const refused = report.status === 'REJECTED'
  const resolved = step.index === 3 && !refused

  useEffect(() => {
    titleRef.current?.focus()
  }, [report.id])

  const copy = () => {
    void navigator.clipboard.writeText(report.code).then(
      () => announce(messagesFor(messages).copied),
      () => announce(messagesFor(messages).selectToCopy),
    )
  }

  return (
    <>
      <div className={styles.line}>
        <Plate>{report.code}</Plate>
        <Pill tone={step.tone}>{step.name}</Pill>
      </div>
      <h3 ref={titleRef} tabIndex={-1}>
        {m.title}
      </h3>
      <p className={styles.confirm} role="status">
        {report.confirmation}
      </p>
      {stale && <p className={text.note}>{m.stale}</p>}
      <p className={text.note}>
        {report.title}. {report.location || m.positionSent}
        {report.districtName ? `, ${report.districtName}` : ''}. {m.summary(categoryLabel(report.category, locale), urgencyLabel(report.urgency, locale))}
      </p>
      {refused ? (
        <p className={text.note}>{m.refused}</p>
      ) : (
        <ol className={[styles.timeline, resolved && styles.resolved].filter(Boolean).join(' ')}>
          {steps.map((item, i) => {
            const state = i < step.index || resolved ? 'done' : i === step.index ? 'current' : 'upcoming'
            return (
              <li key={item.name} className={styles[state]} aria-current={i === step.index ? 'step' : undefined}>
                <span className={styles.rail}>
                  <span className={styles.station}>{state === 'done' && <Icon name="check" size={13} stroke={3} />}</span>
                  {i < steps.length - 1 && <span className={styles.track} />}
                </span>
                <span className={styles.step}>
                  <b>{i === step.index ? step.name : item.name}</b>
                  <span className={text.note}>{i <= step.index ? item.note : m.upcoming}</span>
                </span>
                <span className={styles.time}>{i === 0 ? report.receivedAt : ''}</span>
              </li>
            )
          })}
        </ol>
      )}
      <div className={styles.geo}>
        <Button type="button" variant="ghost" small onClick={copy}>
          {m.copy}
        </Button>
        <Button type="button" variant="ghost" small onClick={reset}>
          {m.another}
        </Button>
      </div>
    </>
  )
}
