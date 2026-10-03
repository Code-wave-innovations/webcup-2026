import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { ActiveAlert } from './types'

// D18 / F29 / F31: alerts in force now (GET /api/alerts/active), critical first

export const alertKeys = {
  all: ['alerts'] as const,
  active: () => [...alertKeys.all, 'active'] as const,
}

export const useActiveAlerts = () =>
  useQuery({
    queryKey: alertKeys.active(),
    queryFn: () => http.get<ActiveAlert[]>('/alerts/active').then((r) => r.data),
    refetchInterval: REFRESH.alerts,
  })
