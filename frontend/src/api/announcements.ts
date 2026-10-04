import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { Announcement, Paginated } from './types'

// D06 / F30: what the city published (GET /api/announcements, newest first)

export const announcementKeys = {
  all: ['announcements'] as const,
  latest: (limit: number) => [...announcementKeys.all, 'latest', limit] as const,
}

export const useLatestAnnouncements = (limit = 3) =>
  useQuery({
    queryKey: announcementKeys.latest(limit),
    queryFn: () => http.get<Paginated<Announcement>>('/announcements', { params: { limit } }).then((r) => r.data.data),
    refetchInterval: REFRESH.alerts,
  })
