import { create } from 'zustand'
import { REQUESTS } from '../mocks/requests'
import { ALL_USERS } from '../mocks/people'
import type { CitizenRequest, RequestEvent, RequestPriority, RequestStatus } from '../mocks/types'
import { FINAL_STATUSES, PRIORITY_LABEL, STATUS_LABEL } from '../lib/labels'
import { toast } from './toastStore'

interface RequestState {
  requests: CitizenRequest[]
}

export const useRequestStore = create<RequestState>()(() => ({ requests: REQUESTS }))

let nextEventId = 10_000

const fullName = (id: number | null) => {
  const user = ALL_USERS.find((u) => u.id === id)
  return user ? `${user.name} ${user.last_name}` : 'personne'
}

function update(id: number, change: (r: CitizenRequest) => Partial<CitizenRequest>, events: Omit<RequestEvent, 'id' | 'created_at'>[]) {
  const at = new Date().toISOString()
  useRequestStore.setState((s) => ({
    requests: s.requests.map((r) =>
      r.id === id
        ? {
            ...r,
            ...change(r),
            updated_at: at,
            events: [...r.events, ...events.map((e) => ({ ...e, id: nextEventId++, created_at: at }))],
          }
        : r,
    ),
  }))
}

const find = (id: number) => useRequestStore.getState().requests.find((r) => r.id === id)

/* Simulated actions. When binding the API, each becomes a PATCH /api/requests/:id call. */

export function changeStatus(id: number, to: RequestStatus, actorId: number, note?: string, internal = false) {
  const request = find(id)
  if (!request || request.status === to) return
  update(
    id,
    () => ({ status: to, resolved_at: FINAL_STATUSES.includes(to) ? new Date().toISOString() : null }),
    [{ type: 'STATUS_CHANGED', author_id: actorId, from_status: request.status, to_status: to, message: note || null, is_internal: internal }],
  )
  toast(`${request.reference} → ${STATUS_LABEL[to]}`)
}

export function assignRequest(id: number, agentId: number | null, actorId: number) {
  const request = find(id)
  if (!request || request.assigned_agent_id === agentId) return
  const pickUp = agentId !== null && request.status === 'SUBMITTED'
  update(
    id,
    () => ({ assigned_agent_id: agentId, ...(pickUp ? { status: 'IN_REVIEW' as const } : {}) }),
    [
      { type: 'ASSIGNED', author_id: actorId, from_status: null, to_status: null, message: null, is_internal: true },
      ...(pickUp
        ? [{ type: 'STATUS_CHANGED' as const, author_id: actorId, from_status: 'SUBMITTED' as const, to_status: 'IN_REVIEW' as const, message: null, is_internal: false }]
        : []),
    ],
  )
  toast(agentId ? `${request.reference} assignée à ${fullName(agentId)}` : `${request.reference} désassignée`)
}

export function setPriority(id: number, priority: RequestPriority, actorId: number) {
  const request = find(id)
  if (!request || request.priority === priority) return
  update(id, () => ({ priority }), [
    { type: 'PRIORITY_CHANGED', author_id: actorId, from_status: null, to_status: null, message: PRIORITY_LABEL[priority], is_internal: true },
  ])
  toast(`Priorité ${PRIORITY_LABEL[priority].toLowerCase()} pour ${request.reference}`, 'info')
}

export function addComment(id: number, message: string, actorId: number, internal: boolean) {
  const request = find(id)
  if (!request) return
  update(id, () => ({}), [{ type: 'COMMENT', author_id: actorId, from_status: null, to_status: null, message, is_internal: internal }])
  toast(internal ? 'Note interne ajoutée' : 'Message envoyé au citoyen')
}
