import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import type { InterruptionScope, ServiceInterruption } from './types'

// F38: maintenance and incidents (GET /api/service-interruptions: current/upcoming/active public;
// scope=all is staff-only history — D09). Writing is open to the staff.

export const interruptionKeys = {
  all: ['interruptions'] as const,
  list: (scope: InterruptionScope) => [...interruptionKeys.all, 'list', scope] as const,
}

export const useInterruptions = (scope: InterruptionScope) =>
  useQuery({
    queryKey: interruptionKeys.list(scope),
    queryFn: () => http.get<ServiceInterruption[]>('/service-interruptions', { params: { scope } }).then((r) => r.data),
    refetchInterval: REFRESH.alerts,
  })

export interface InterruptionInput {
  service_id?: number
  type?: 'MAINTENANCE' | 'INCIDENT'
  impact?: 'DEGRADED' | 'UNAVAILABLE'
  reason?: string
  alternative?: string | null
  starts_at?: string
  ends_at?: string | null
}

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: interruptionKeys.all })
  void queryClient.invalidateQueries({ queryKey: ['services'] })
  void queryClient.invalidateQueries({ queryKey: ['home'] })
}

/** The answer says how many citizens with an appointment were warned (`notified`) */
export const useSaveInterruption = () =>
  useMutation({
    mutationFn: ({ id, ...input }: InterruptionInput & { id?: number }) =>
      (id
        ? http.patch<ServiceInterruption>(`/service-interruptions/${id}`, input)
        : http.post<ServiceInterruption & { notified: number }>('/service-interruptions', input)
      ).then((r) => r.data as ServiceInterruption & { notified?: number }),
    onSuccess: refresh,
  })

export const useEndInterruption = () =>
  useMutation({
    mutationFn: (id: number) => http.post<ServiceInterruption>(`/service-interruptions/${id}/end`).then((r) => r.data),
    onSuccess: refresh,
  })

export const useDeleteInterruption = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/service-interruptions/${id}`).then((r) => r.data),
    onSuccess: refresh,
  })
