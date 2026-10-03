import type { CitizenRequest } from '../mocks/types'
import { EVENT_LABEL, STATUS_LABEL, STATUS_TONE } from '../lib/labels'
import { formatDateTime, formatRelative } from '../lib/format'
import { fullName, useUsersById } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { Timeline, type TimelineItem } from '../ui/Timeline'

/** D11 / F26 / F48: every step of a request, internal notes marked as such. */
export function RequestTimeline({ request }: { request: CitizenRequest }) {
  const users = useUsersById()
  const now = useNow()
  const events = [...request.events].reverse()
  const items: TimelineItem[] = events.map((event, index) => {
    const author = event.author_id ? users.get(event.author_id) : undefined
    const who = author ? `${fullName(author)}${author.role === 'CITIZEN' ? ' (citoyen)' : ''}` : 'Système'
    let title: string = EVENT_LABEL[event.type]
    if (event.type === 'STATUS_CHANGED' && event.from_status && event.to_status) {
      title = `${STATUS_LABEL[event.from_status]} → ${STATUS_LABEL[event.to_status]}`
    } else if (event.type === 'PRIORITY_CHANGED') {
      title = `Priorité : ${event.message ?? ''}`
    } else if (event.type === 'ASSIGNED') {
      title = `Assignée à ${fullName(users.get(request.assigned_agent_id ?? -1))}`
    }
    return {
      id: event.id,
      title,
      meta: `${who} · ${formatRelative(event.created_at, now)} · ${formatDateTime(event.created_at)}`,
      body: event.type !== 'PRIORITY_CHANGED' && event.message ? event.message : undefined,
      tone: event.to_status ? STATUS_TONE[event.to_status] : event.type === 'COMMENT' ? 'ice' : 'neutral',
      internal: event.is_internal,
      current: index === 0,
    }
  })
  return <Timeline items={items} label={`Historique de ${request.reference}`} />
}
