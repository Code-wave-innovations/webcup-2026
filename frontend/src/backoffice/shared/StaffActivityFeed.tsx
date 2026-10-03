import { Link } from 'react-router'
import type { StaffActivity } from '../../api/types'
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/labels'
import { formatDateTime, formatRelative } from '../lib/format'
import { fullName } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { Avatar, EmptyState } from '../ui/Feedback'
import styles from './shared.module.css'

/** What one step says, after the name of the person who did it. */
function action(event: StaffActivity): string {
  switch (event.type) {
    case 'STATUS_CHANGED':
      return event.from_status && event.to_status
        ? `a passé de « ${STATUS_LABEL[event.from_status]} » à « ${STATUS_LABEL[event.to_status]} »`
        : 'a changé l’état de'
    case 'ASSIGNED':
      return event.message ? `a assigné à ${event.message}` : 'a changé l’assignation de'
    case 'PRIORITY_CHANGED': {
      const priority = PRIORITY_LABEL[event.message as keyof typeof PRIORITY_LABEL]
      return priority ? `a mis en priorité ${priority.toLowerCase()}` : 'a changé la priorité de'
    }
    case 'COMMENT':
      return event.is_internal ? 'a ajouté une note interne sur' : 'a répondu à l’habitant sur'
    default:
      return 'a modifié'
  }
}

/** F22 / D19: the latest actions of the staff on the requests, each linked to its request. */
export function StaffActivityFeed({ events, base }: { events: StaffActivity[]; base: '/agent' | '/admin' }) {
  const now = useNow()
  if (events.length === 0) return <EmptyState title="Aucune action récente" icon="activity" />
  return (
    <ol className={styles.feed} aria-label="Dernières actions du personnel">
      {events.map((event) => (
        <li key={event.id} className={styles.feedItem}>
          <Avatar name={event.author.name} lastName={event.author.last_name} size={30} tone={event.author.role === 'ADMIN' ? 'ember' : 'ice'} />
          <div className={styles.sentence}>
            <strong>{fullName(event.author)}</strong> {action(event)}{' '}
            <Link to={`${base}/demandes/${event.request.id}`}>
              <em>{event.request.reference}</em>
            </Link>
            {event.type === 'COMMENT' && event.message && <div className={styles.diff}>« {event.message} »</div>}
          </div>
          <span className={styles.when}>
            {formatRelative(event.created_at, now)}
            <small>{formatDateTime(event.created_at)}</small>
          </span>
        </li>
      ))}
    </ol>
  )
}
