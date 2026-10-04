import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { readEssential, restored } from './essentialCache'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { Announcement, AnnouncementCategory, Paginated } from './types'

// D06: municipal publications (GET /api/announcements), public list only

export const ANNOUNCEMENT_CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  NEWS: 'Actualité',
  SERVICE_CHANGE: 'Changement de service',
  PRACTICAL_INFO: 'Information pratique',
  EVENT: 'Événement',
}

export const ANNOUNCEMENT_CATEGORIES = Object.keys(ANNOUNCEMENT_CATEGORY_LABEL) as AnnouncementCategory[]

export interface AnnouncementFilters {
  category?: AnnouncementCategory
  q?: string
  page?: number
  limit?: number
}

export const announcementKeys = {
  all: ['announcements'] as const,
  lists: () => [...announcementKeys.all, 'list'] as const,
  list: (filters: AnnouncementFilters) => [...announcementKeys.lists(), filters] as const,
  detail: (id: number) => [...announcementKeys.all, 'detail', id] as const,
}

/**
 * The flyover only saves its three lines. A filtered or longer list must not pretend that snapshot is complete.
 */
function cachedLatest(filters: AnnouncementFilters): Paginated<Announcement> | undefined {
  if (filters.limit !== 3 || filters.category || filters.q || filters.page) return undefined
  const items = readEssential()?.announcements
  if (!items) return undefined
  return {
    data: items,
    meta: { page: 1, limit: 3, total: items.length, pages: 1 },
  }
}

export const useAnnouncements = (filters: AnnouncementFilters = {}) =>
  useQuery({
    queryKey: announcementKeys.list(filters),
    queryFn: () => http.get<Paginated<Announcement>>('/announcements', { params: filters }).then((r) => r.data),
    placeholderData: keepPreviousData,
    // F95: publications are not live news (alerts have their own channel): no polling, fresh for 5 minutes
    staleTime: REFRESH.reference,
    ...restored(cachedLatest(filters)),
  })

export const useAnnouncement = (id: number | undefined) =>
  useQuery({
    queryKey: announcementKeys.detail(id ?? 0),
    queryFn: () => http.get<Announcement>(`/announcements/${id}`).then((r) => r.data),
    enabled: id !== undefined && Number.isInteger(id) && id > 0,
  })

/** The flyover's short list, as an array, so the offline snapshot can store it directly. */
export const useLatestAnnouncements = (limit = 3) => {
  const query = useAnnouncements({ limit })
  return { ...query, data: query.data?.data }
}
