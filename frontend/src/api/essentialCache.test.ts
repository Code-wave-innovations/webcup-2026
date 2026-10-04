import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import type { ActiveAlert, Announcement, CityService, PlatformSettings } from './types'
import { alertViewerKey, alertsForViewer, catalogueFromSnapshot, formatSavedAt, isNetworkFailure, readEssential, rememberEssential, restored, type EssentialSnapshot } from './essentialCache'

const memory = new Map<string, string>()

afterEach(() => {
  memory.clear()
  vi.unstubAllGlobals()
})

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  })
}

function service(id: number, slug: string): CityService {
  return { id, category: { id: 1, slug, name: slug, icon: null } } as CityService
}

describe('essential cache', () => {
  it('keeps a previous field when a later save only adds another', () => {
    stubStorage()
    rememberEssential({ settings: { maintenance_mode: false } as PlatformSettings })
    rememberEssential({ announcements: [{ id: 4, title: 'Coupure' } as Announcement] })
    const snap = readEssential()
    expect(snap?.settings?.maintenance_mode).toBe(false)
    expect(snap?.announcements?.[0]?.title).toBe('Coupure')
    expect(snap?.savedAt).toBeTruthy()
  })

  it('ignores a broken snapshot', () => {
    stubStorage()
    memory.set('nova-essential', '{')
    expect(readEssential()).toBeNull()
  })

  it('rebuilds a category page and refuses a text search', () => {
    const snap: EssentialSnapshot = {
      savedAt: '2026-10-04T03:00:00.000Z',
      serviceList: [service(1, 'sante'), service(2, 'voirie')],
    }
    expect(catalogueFromSnapshot(snap, { category: 'sante', limit: 6 })?.data.map((s) => s.id)).toEqual([1])
    expect(catalogueFromSnapshot(snap, { category: 'eau' })).toBeUndefined()
    expect(catalogueFromSnapshot(snap, { category: null, q: 'médecin' })).toBeUndefined()
  })

  it('shows the snapshot at once and still treats it as stale', () => {
    expect(restored(['annonce'])).toEqual({ initialData: ['annonce'], initialDataUpdatedAt: 0 })
    expect(restored(undefined)).toEqual({})
  })

  it('gives alerts back only to the same viewer', () => {
    const snap: EssentialSnapshot = {
      savedAt: '2026-10-04T03:00:00.000Z',
      alerts: { viewerKey: 'citizen:7', items: [{ id: 1 } as ActiveAlert] },
    }
    expect(alertViewerKey('token', 7)).toBe('citizen:7')
    expect(alertViewerKey(null, null)).toBe('public')
    expect(alertViewerKey('token', null)).toBe('film')
    expect(alertsForViewer(snap, 'citizen:7')).toHaveLength(1)
    expect(alertsForViewer(snap, 'public')).toBeUndefined()
  })

  it('treats a missing response as a network failure', () => {
    expect(isNetworkFailure(new ApiError(0, 'NETWORK_ERROR', 'fail'))).toBe(true)
    expect(isNetworkFailure(new ApiError(500, 'INTERNAL_ERROR', 'fail'))).toBe(false)
  })

  it('prints the reception time in Madagascar', () => {
    expect(formatSavedAt('2026-10-04T03:06:00.000Z')).toContain('06:06')
    expect(formatSavedAt('nope')).toBe('')
  })
})
