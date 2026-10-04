import type { RequestStatus } from '../../api/types'
import { CITIZEN_STATUS_LABEL, FRISE_STEPS, friseIndex, friseTone } from '../../api/requestStatus'
import styles from './Espace.module.css'

/** D11: visual progress strip for a citizen request. */
export function RequestFrise({ status }: { status: RequestStatus }) {
  const active = friseIndex(status)
  const tone = friseTone(status)

  return (
    <ol className={styles.frise} data-tone={tone} aria-label="Étapes de la demande">
      {FRISE_STEPS.map((label, i) => (
        <li key={label} data-state={i < active ? 'done' : i === active ? 'current' : 'todo'}>
          <span className={styles.friseDot} aria-hidden="true" />
          <span>{tone === 'rejected' && i === active ? CITIZEN_STATUS_LABEL.REJECTED : label}</span>
        </li>
      ))}
    </ol>
  )
}
