import type { RequestStatus } from '../../api/types'
import { friseIndex, friseTone, requestStatusMessages } from '../../api/requestStatus'
import { defineMessages, useMessages } from '../../i18n'
import styles from './Espace.module.css'

const messages = defineMessages({ label: 'Étapes de la demande' }, { label: 'Request steps' })

/** D11: visual progress strip for a citizen request. */
export function RequestFrise({ status }: { status: RequestStatus }) {
  const m = useMessages(messages)
  const labels = useMessages(requestStatusMessages)
  const active = friseIndex(status)
  const tone = friseTone(status)

  return (
    <ol className={styles.frise} data-tone={tone} aria-label={m.label}>
      {labels.frise.map((label, i) => (
        <li key={label} data-state={i < active ? 'done' : i === active ? 'current' : 'todo'}>
          <span className={styles.friseDot} aria-hidden="true" />
          <span>{tone === 'rejected' && i === active ? labels.status.REJECTED : label}</span>
        </li>
      ))}
    </ol>
  )
}
