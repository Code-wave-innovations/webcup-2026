import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { alertViewerKey, alertsForViewer, readEssential, restored } from './essentialCache'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import { useCitizenUser } from './session'
import type { ActiveAlert, AlertAudience, AlertInput, CityAlert, Paginated } from './types'

// D18 / F29 / F31: alerts in force now (GET /api/alerts/active), and their composer (staff)

export const alertKeys = {
  all: ['alerts'] as const,
  active: (viewer: string | null = null) => [...alertKeys.all, 'active', viewer] as const,
  list: () => [...alertKeys.all, 'list'] as const,
  audience: (audience: AlertAudience, districtIds: number[]) => [...alertKeys.all, 'audience', audience, districtIds] as const,
}

/**
 * Every alert in force, critical first. `token` is the citizen session's: the server then says which
 * alerts concern this person (`concerns_me`); without it only the city-wide ones do.
 */
export const useActiveAlerts = (token?: string | null) => {
  const snap = readEssential()
  const cached = alertsForViewer(snap, alertViewerKey(token, useCitizenUser()?.id ?? null))
  return useQuery({
    queryKey: alertKeys.active(token ? 'me' : null),
    queryFn: () => http.get<ActiveAlert[]>('/alerts/active', token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then((r) => r.data),
    refetchInterval: REFRESH.alerts,
    // a banner must not wait for the tab to be focused again
    refetchIntervalInBackground: true,
    ...restored(cached),
  })
}

/** The history (staff): in force, programmed and ended, most serious first */
export const useAlerts = () =>
  useQuery({
    queryKey: alertKeys.list(),
    queryFn: () => http.get<Paginated<CityAlert>>('/alerts', { params: { limit: 100 } }).then((r) => r.data.data),
    refetchInterval: REFRESH.alerts,
  })

/** How many people an alert would reach, counted the way the server notifies */
export const useAlertAudience = (audience: AlertAudience, districtIds: number[]) =>
  useQuery({
    queryKey: alertKeys.audience(audience, districtIds),
    queryFn: () =>
      http.get<{ count: number }>('/notifications/audience', { params: { audience, district_ids: districtIds.join(',') || undefined } }).then((r) => r.data.count),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

const refresh = () => queryClient.invalidateQueries({ queryKey: alertKeys.all })

export const useCreateAlert = () =>
  useMutation({
    mutationFn: (input: AlertInput) =>
      http.post<CityAlert & { notified: number; scheduled: boolean }>('/alerts', input).then((r) => r.data),
    onSuccess: refresh,
  })

export const useCloseAlert = () =>
  useMutation({
    mutationFn: (id: number) => http.post<CityAlert>(`/alerts/${id}/close`).then((r) => r.data),
    onSuccess: refresh,
  })
