import { create } from 'zustand'
import { ALERTS, ANNOUNCEMENTS, BROADCASTS } from '../mocks/content'
import { CITIZENS } from '../mocks/people'
import type { Alert, AlertAudience, Announcement, Broadcast } from '../mocks/types'
import { recordAudit } from './auditStore'
import { toast } from './toastStore'

interface ContentState {
  announcements: Announcement[]
  alerts: Alert[]
  broadcasts: Broadcast[]
}

export const useContentStore = create<ContentState>()(() => ({
  announcements: ANNOUNCEMENTS,
  alerts: ALERTS,
  broadcasts: BROADCASTS,
}))

let nextId = 100

/** How many citizens an audience reaches (simulated on the demo population, scaled up). */
export function estimateAudience(audience: AlertAudience | 'STAFF', districtIds: number[]): number {
  if (audience === 'STAFF') return 5
  const scale = 124
  const pool = CITIZENS.filter((c) => c.is_active)
  const inDistricts = (c: (typeof pool)[number]) => districtIds.length === 0 || (c.district_id !== null && districtIds.includes(c.district_id))
  if (audience === 'ALL') return pool.length * scale
  if (audience === 'DISTRICTS') return pool.filter(inDistricts).length * scale
  return pool.filter((c) => c.is_vulnerable && inDistricts(c)).length * scale
}

/* Simulated content management (D06, D18, F29, F30, F31). */

export function saveAnnouncement(input: Omit<Announcement, 'id' | 'created_at' | 'published_at'> & { id?: number }, actorId: number) {
  const now = new Date().toISOString()
  const existing = input.id ? useContentStore.getState().announcements.find((a) => a.id === input.id) : undefined
  const announcement: Announcement = {
    ...input,
    id: existing?.id ?? nextId++,
    created_at: existing?.created_at ?? now,
    published_at: input.status === 'PUBLISHED' ? (existing?.published_at ?? now) : null,
  }
  useContentStore.setState((s) => ({
    announcements: existing ? s.announcements.map((a) => (a.id === announcement.id ? announcement : a)) : [announcement, ...s.announcements],
  }))
  const goesLive = announcement.status === 'PUBLISHED' && existing?.status !== 'PUBLISHED'
  if (goesLive) {
    recordAudit({
      actor_id: actorId,
      action: 'announcement.published',
      entity: 'Announcement',
      entity_id: announcement.id,
      entity_label: announcement.title,
      changes: [{ field: 'status', before: existing?.status ?? null, after: 'PUBLISHED' }],
    })
    if (announcement.is_important) sendBroadcast({ title: `Annonce importante : ${announcement.title}`, body: announcement.summary ?? '', audience: 'ALL', district_ids: [] }, actorId, true)
  }
  toast(goesLive ? `« ${announcement.title} » publiée${announcement.is_important ? ' et notifiée' : ''}` : 'Annonce enregistrée')
}

export function setAnnouncementStatus(id: number, status: Announcement['status'], actorId: number) {
  const announcement = useContentStore.getState().announcements.find((a) => a.id === id)
  if (!announcement) return
  saveAnnouncement({ ...announcement, status }, actorId)
}

export function createAlert(input: Omit<Alert, 'id' | 'notified' | 'is_active' | 'starts_at' | 'ends_at'>, actorId: number) {
  const notified = estimateAudience(input.audience, input.district_ids)
  const alert: Alert = { ...input, id: nextId++, notified, is_active: true, starts_at: new Date().toISOString(), ends_at: null }
  useContentStore.setState((s) => ({ alerts: [alert, ...s.alerts] }))
  recordAudit({
    actor_id: actorId,
    action: 'alert.created',
    entity: 'Alert',
    entity_id: alert.id,
    entity_label: alert.title,
    changes: [
      { field: 'severity', before: null, after: alert.severity },
      { field: 'audience', before: null, after: alert.audience },
    ],
  })
  toast(`Alerte diffusée à ${notified.toLocaleString('fr-FR')} personnes`, 'alert')
}

export function closeAlert(id: number, actorId: number) {
  const alert = useContentStore.getState().alerts.find((a) => a.id === id)
  if (!alert) return
  useContentStore.setState((s) => ({
    alerts: s.alerts.map((a) => (a.id === id ? { ...a, is_active: false, ends_at: new Date().toISOString() } : a)),
  }))
  recordAudit({
    actor_id: actorId,
    action: 'alert.created',
    entity: 'Alert',
    entity_id: id,
    entity_label: alert.title,
    changes: [{ field: 'is_active', before: 'true', after: 'false' }],
  })
  toast(`Alerte « ${alert.title} » terminée`, 'info')
}

export function sendBroadcast(input: Pick<Broadcast, 'title' | 'body' | 'audience' | 'district_ids'>, actorId: number, silent = false) {
  const broadcast: Broadcast = {
    ...input,
    id: nextId++,
    recipients: estimateAudience(input.audience, input.district_ids),
    read_rate: 0,
    sent_at: new Date().toISOString(),
    author_id: actorId,
  }
  useContentStore.setState((s) => ({ broadcasts: [broadcast, ...s.broadcasts] }))
  recordAudit({
    actor_id: actorId,
    action: 'broadcast.sent',
    entity: 'Broadcast',
    entity_id: broadcast.id,
    entity_label: broadcast.title,
    changes: [{ field: 'destinataires', before: null, after: String(broadcast.recipients) }],
  })
  if (!silent) toast(`Notification envoyée à ${broadcast.recipients.toLocaleString('fr-FR')} personnes`)
}
