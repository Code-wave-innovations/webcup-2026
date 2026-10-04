import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import type { AppNotification, NotificationPage } from './types'

// F30 (and the notices sent by D16, F37, F40, F49): the signed-in account's notifications

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  list: (limit: number) => [...notificationKeys.all, 'list', limit] as const,
}

export const useUnreadCount = () =>
  useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => http.get<{ unread: number }>('/notifications/unread-count').then((r) => r.data.unread),
    refetchInterval: REFRESH.notifications,
  })

/**
 * The latest notifications, fetched only while they are on screen. F95: no polling of its own, the unread
 * counter already polls; opening the panel again after `staleTime` fetches a fresh list.
 */
export const useNotifications = (limit: number, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(limit),
    queryFn: () => http.get<NotificationPage>('/notifications', { params: { limit } }).then((r) => r.data),
    enabled,
  })

const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all })

export const useMarkRead = () =>
  useMutation({
    mutationFn: (id: number) => http.patch<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: refresh,
  })

export const useMarkAllRead = () =>
  useMutation({
    mutationFn: () => http.post<{ updated: number }>('/notifications/read-all').then((r) => r.data),
    onSuccess: refresh,
  })
