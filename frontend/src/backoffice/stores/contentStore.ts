import { create } from 'zustand'
import { ANNOUNCEMENTS, BROADCASTS } from '../mocks/content'
import { CITIZENS } from '../mocks/people'
import type { AlertAudience, Announcement, Broadcast } from '../mocks/types'
import { toast } from './toastStore'

interface ContentState {
  announcements: Announcement[]
  broadcasts: Broadcast[]
}

export const useContentStore = create<ContentState>()(() => ({
  announcements: ANNOUNCEMENTS,
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

/* Simulated content management (D06, F30); alerts (D18, F29, F31) are bound to the API. */

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
    if (announcement.is_important) sendBroadcast({ title: `Annonce importante : ${announcement.title}`, body: announcement.summary ?? '', audience: 'ALL', district_ids: [] }, actorId, true)
  }
  toast(goesLive ? `« ${announcement.title} » publiée${announcement.is_important ? ' et notifiée' : ''}` : 'Annonce enregistrée')
}

export function setAnnouncementStatus(id: number, status: Announcement['status'], actorId: number) {
  const announcement = useContentStore.getState().announcements.find((a) => a.id === id)
  if (!announcement) return
  saveAnnouncement({ ...announcement, status }, actorId)
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
  if (!silent) toast(`Notification envoyée à ${broadcast.recipients.toLocaleString('fr-FR')} personnes`)
}
