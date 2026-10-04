import { Link } from 'react-router'
import type { SecurityEvent } from '../../api/types'
import { usePersona } from '../layout/persona'
import { entityLink } from '../lib/auditText'
import { formatDateTime, formatRelative } from '../lib/format'
import { securityEventLook } from '../lib/securityEvents'
import { useNow } from '../lib/useNow'
import { Tag } from '../ui/Badges'
import { EmptyState } from '../ui/Feedback'
import styles from './shared.module.css'

/** F100: one readable line per security event, without IP. */
export function SecurityEventList({ events }: { events: SecurityEvent[] }) {
  const now = useNow()
  const persona = usePersona()
  const base = persona === 'ADMIN' ? '/admin' : '/agent'

  if (events.length === 0) return <EmptyState title="Aucun événement de sécurité" icon="shield" />

  return (
    <ol className={styles.feed} aria-label="Événements de sécurité">
      {events.map((event) => {
        const look = securityEventLook(event.type)
        const link = event.account.id !== null ? entityLink({ entity: 'User', entity_id: event.account.id }, base) : null
        const account = event.account.label ?? event.account.email
        return (
          <li key={event.id} className={styles.feedItem}>
            <Tag tone={look.tone}>{look.title}</Tag>
            <span className={styles.sentence}>
              {account &&
                (link ? (
                  <Link to={link}>
                    <em>{account}</em>
                  </Link>
                ) : (
                  <em>{account}</em>
                ))}
              {event.count > 1 && <span> ×{event.count}</span>}
              {event.detail && <span className={styles.diff}>{event.detail}</span>}
            </span>
            <span className={styles.when} title={formatDateTime(event.at)}>
              {formatRelative(event.at, now)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
