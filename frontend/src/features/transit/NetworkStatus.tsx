import { messageFor } from '../../api/errors'
import { transitStatusLabel, useTransitDisruptions } from '../../api/transit'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Pill } from '../../ui/Badges'
import { GlassPanel } from '../../ui/GlassPanel'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { STATUS_TONE } from './transitText'
import styles from './Transit.module.css'

const messages = defineMessages(
  {
    loading: 'Chargement de l’état du réseau…',
    allGood: 'Toutes les lignes fonctionnent normalement.',
    seeLine: (code: string) => `Voir la ligne ${code} et ses horaires`,
  },
  {
    loading: 'Loading network status…',
    allGood: 'All lines are running normally.',
    seeLine: (code) => `See line ${code} and its timetable`,
  },
)

/** F36: lines not running normally, with what happens and when service resumes (in the line's message). */
export function NetworkStatus({ onOpenLine }: { onOpenLine: (code: string) => void }) {
  const disruptions = useTransitDisruptions()
  const m = useMessages(messages)
  const locale = useLocale()

  if (disruptions.isError) return <p className={text.error}>{messageFor(disruptions.error)}</p>
  if (!disruptions.data) return <p className={text.note}>{m.loading}</p>
  if (disruptions.data.length === 0) {
    return (
      <GlassPanel>
        <p className={styles.allGood}>
          <Icon name="check" /> {m.allGood}
        </p>
      </GlassPanel>
    )
  }
  return (
    <ul className={styles.disruptions}>
      {disruptions.data.map((line) => (
        <li key={line.id}>
          <GlassPanel className={styles.disruption} data-status={line.status}>
            <div className={styles.disruptionHead}>
              <LineBadge line={line} />
              <Pill tone={STATUS_TONE[line.status]}>
                <Icon name="alert" size={14} /> {transitStatusLabel(line.status, locale)}
              </Pill>
            </div>
            {line.status_message && <p className={styles.message}>{line.status_message}</p>}
            <button type="button" className={styles.textButton} onClick={() => onOpenLine(line.code)}>
              {m.seeLine(line.code)}
            </button>
          </GlassPanel>
        </li>
      ))}
    </ul>
  )
}
