import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { DashboardStats, DashboardSummary, DashboardTrends, SummaryPeriod } from './types'

// D17 / D19 / F50: staff dashboards (GET /api/dashboard/stats, /trends, /summary)

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  trends: (days: number) => [...dashboardKeys.all, 'trends', days] as const,
  summary: (period: SummaryPeriod) => [...dashboardKeys.all, 'summary', period] as const,
}

export const useDashboardStats = (enabled = true) =>
  useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => http.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
    enabled,
    refetchInterval: REFRESH.dashboard,
  })

export const useDashboardTrends = (days = 14) =>
  useQuery({
    queryKey: dashboardKeys.trends(days),
    queryFn: () => http.get<DashboardTrends>('/dashboard/trends', { params: { days } }).then((r) => r.data),
    refetchInterval: REFRESH.dashboard,
  })

/** Keeps the previous period on screen while the next one loads. */
export const useDashboardSummary = (period: SummaryPeriod) =>
  useQuery({
    queryKey: dashboardKeys.summary(period),
    queryFn: () => http.get<DashboardSummary>('/dashboard/summary', { params: { period } }).then((r) => r.data),
    refetchInterval: REFRESH.dashboard,
    placeholderData: keepPreviousData,
  })

