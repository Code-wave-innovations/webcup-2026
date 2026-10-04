import { toApiError } from './errors'
import type { ActiveAlert, Announcement, CityService, District, Paginated, PlatformSettings, ServiceCategory } from './types'

/**
 * Last public payload the citizen space managed to load. A later visit with no network
 * still shows it: announcements, service state, contacts, districts, alerts for the same person.
 */
const STORAGE_KEY = 'nova-essential'

export interface EssentialSnapshot {
  savedAt: string
  settings?: PlatformSettings
  announcements?: Announcement[]
  /** Active catalogue, featured first, as `/api/services?limit=100` returns it. */
  serviceList?: CityService[]
  categories?: ServiceCategory[]
  districts?: District[]
  alerts?: { viewerKey: string; items: ActiveAlert[] }
}

const FIELDS = ['settings', 'announcements', 'serviceList', 'categories', 'districts', 'alerts'] as const

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isSnapshot(value: unknown): value is EssentialSnapshot {
  if (!value || typeof value !== 'object') return false
  const snap = value as EssentialSnapshot
  if (typeof snap.savedAt !== 'string') return false
  if (snap.announcements !== undefined && !Array.isArray(snap.announcements)) return false
  if (snap.serviceList !== undefined && !Array.isArray(snap.serviceList)) return false
  if (snap.categories !== undefined && !Array.isArray(snap.categories)) return false
  if (snap.districts !== undefined && !Array.isArray(snap.districts)) return false
  if (snap.alerts !== undefined && (typeof snap.alerts.viewerKey !== 'string' || !Array.isArray(snap.alerts.items))) return false
  return true
}

export function readEssential(): EssentialSnapshot | null {
  const storage = browserStorage()
  if (!storage) return null
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '')
    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Keeps every field already saved. An undefined field in the patch does not erase it. */
export function rememberEssential(patch: Partial<Omit<EssentialSnapshot, 'savedAt'>>): void {
  const storage = browserStorage()
  if (!storage) return
  const next: EssentialSnapshot = { ...(readEssential() ?? { savedAt: '' }), savedAt: new Date().toISOString() }
  let changed = false
  for (const key of FIELDS) {
    const value = patch[key]
    if (value !== undefined) {
      next[key] = value as never
      changed = true
    }
  }
  if (!changed) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // private mode or a full disk: this visit still holds the data in memory
  }
}

/** Public alerts, or the signed-in citizen's. A film-only session never reuses someone else's. */
export function alertViewerKey(token: string | null | undefined, userId: number | null | undefined): string {
  if (!token) return 'public'
  return userId != null ? `citizen:${userId}` : 'film'
}

export function alertsForViewer(snap: EssentialSnapshot | null, viewerKey: string): ActiveAlert[] | undefined {
  if (!snap?.alerts || snap.alerts.viewerKey !== viewerKey) return undefined
  return snap.alerts.items
}

/**
 * The catalogue screen can rebuild a category page from the saved list.
 * A text search stays on the server: its ranking is not the list order.
 */
export function catalogueFromSnapshot(
  snap: EssentialSnapshot | null,
  filters: { category: string | null; q?: string; limit?: number },
): Paginated<CityService> | undefined {
  if (!snap?.serviceList || filters.q?.trim()) return undefined
  const all = filters.category ? snap.serviceList.filter((service) => service.category?.slug === filters.category) : snap.serviceList
  // An empty category in the snapshot is not proof the server has nothing: keep the normal loading state.
  if (filters.category && all.length === 0) return undefined
  const limit = filters.limit ?? 50
  return {
    data: all.slice(0, limit),
    meta: { page: 1, limit, total: all.length, pages: Math.max(1, Math.ceil(all.length / limit)) },
  }
}

/**
 * Seed a query with the snapshot. The date is epoch so the copy is shown at once and is already
 * stale: a reachable server is still asked on the same load. Absent data stays a normal first load.
 */
export function restored<T>(value: T | undefined): { initialData: T; initialDataUpdatedAt: number } | Record<string, never> {
  if (value === undefined) return {}
  return { initialData: value, initialDataUpdatedAt: 0 }
}

/** No HTTP response: the browser, the wifi or the server could not be reached. */
export function isNetworkFailure(error: unknown): boolean {
  const api = toApiError(error)
  return api.status === 0 || api.code === 'NETWORK_ERROR'
}

/** When the snapshot was received, in Madagascar time, for the banner. */
export function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Antananarivo',
  }).format(date)
}
