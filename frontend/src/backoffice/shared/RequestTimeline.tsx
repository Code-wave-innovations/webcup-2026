import type { RequestDetail } from '../../api/types'
import { EVENT_LABEL, PRIORITY_LABEL, STATUS_LABEL, STATUS_TONE } from '../lib/labels'
import { formatDateTime, formatRelative } from '../lib/format'
import { fullName } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { Timeline, type TimelineItem } from '../ui/Timeline'

const STAFF = ['AGENT', 'ADMIN']

/**
 * D11 / F26 / F48: every step of a request, newest first. Each step says whether the citizen sees it;
 * `asCitizen` shows exactly what the citizen's tracking page shows (no internal step).
 */
export function RequestTimeline({ request, asCitizen }: { request: RequestDetail; asCitizen?: boolean }) {
  const now = useNow()
  const events = [...request.events].reverse().filter((event) => !asCitizen || !event.is_internal)
  const items: TimelineItem[] = events.map((event, index) => {
    const author = event.author
    const staffAuthor = author ? STAFF.includes(author.role) : false
    const who = author ? `${fullName(author)}${author.role === 'CITIZEN' ? ' (habitant)' : ''}` : 'Système'
    let title: string = EVENT_LABEL[event.type]
    if (event.type === 'STATUS_CHANGED' && event.from_status && event.to_status) {
      title = `${STATUS_LABEL[event.from_status]} → ${STATUS_LABEL[event.to_status]}`
    } else if (event.type === 'PRIORITY_CHANGED') {
      const priority = event.message as keyof typeof PRIORITY_LABEL | null
      title = `Priorité : ${priority && PRIORITY_LABEL[priority] ? PRIORITY_LABEL[priority] : (event.message ?? '')}`
    } else if (event.type === 'ASSIGNED') {
      // older steps did not keep the assignee's name
      title = event.message ? `Assignée à ${event.message}` : 'Assignation modifiée'
    }
    return {
      id: event.id,
      title,
      meta: `${who} · ${formatRelative(event.created_at, now)} · ${formatDateTime(event.created_at)}`,
      body: event.type === 'COMMENT' || event.type === 'STATUS_CHANGED' ? (event.message ?? undefined) : undefined,
      tone: event.to_status ? STATUS_TONE[event.to_status] : event.type === 'COMMENT' ? 'ice' : 'neutral',
      internal: asCitizen ? undefined : event.is_internal,
      // F49: the server notifies the citizen with an account of every public change made by the staff
      notified:
        !asCitizen &&
        request.citizen_id !== null &&
        staffAuthor &&
        (event.type === 'STATUS_CHANGED' || (event.type === 'COMMENT' && !event.is_internal)),
      current: index === 0,
    }
  })
  return <Timeline items={items} label={`Historique de ${request.reference}${asCitizen ? ', vu par l’habitant' : ''}`} />
}
