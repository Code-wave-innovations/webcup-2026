import { messageFor } from '../../api/errors'
import { TRANSIT_STATUS_LABEL, useTransitDisruptions } from '../../api/transit'
import { Pill } from '../../ui/Badges'
import { GlassPanel } from '../../ui/GlassPanel'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { STATUS_TONE } from './transitText'
import styles from './Transit.module.css'

/** F36: lines not running normally, with what happens and when service resumes (in the line's message). */
export function NetworkStatus({ onOpenLine }: { onOpenLine: (code: string) => void }) {
  const disruptions = useTransitDisruptions()

  if (disruptions.isError) return <p className={text.error}>{messageFor(disruptions.error)}</p>
  if (!disruptions.data) return <p className={text.note}>Chargement de l’état du réseau…</p>
  if (disruptions.data.length === 0) {
    return (
      <GlassPanel>
        <p className={styles.allGood}>
          <Icon name="check" /> Toutes les lignes fonctionnent normalement.
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
                <Icon name="alert" size={14} /> {TRANSIT_STATUS_LABEL[line.status]}
              </Pill>
            </div>
            {line.status_message && <p className={styles.message}>{line.status_message}</p>}
            <button type="button" className={styles.textButton} onClick={() => onOpenLine(line.code)}>
              Voir la ligne {line.code} et ses horaires
            </button>
          </GlassPanel>
        </li>
      ))}
    </ul>
  )
}
