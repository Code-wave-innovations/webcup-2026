import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { DashboardStats } from './types'

// D17 / D19: staff counters (GET /api/dashboard/stats)

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
}

export const useDashboardStats = (enabled = true) =>
  useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => http.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
    enabled,
    refetchInterval: REFRESH.dashboard,
  })
