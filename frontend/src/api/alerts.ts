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
  /** ISO time of the next alert that has not started, or null. Written by the active query. */
  nextStart: () => [...alertKeys.all, 'next-start'] as const,
  list: () => [...alertKeys.all, 'list'] as const,
  audience: (audience: AlertAudience, districtIds: number[]) => [...alertKeys.all, 'audience', audience, districtIds] as const,
}

function headerTime(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && raw.length > 0 ? raw : null
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
    queryFn: () =>
      http.get<ActiveAlert[]>('/alerts/active', token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then((response) => {
        queryClient.setQueryData(alertKeys.nextStart(), headerTime(response.headers['x-alert-next-at']))
        return response.data
      }),
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

/** The next programmed alert, filled by `useActiveAlerts`. Does not fetch on its own. */
export const useNextAlertStart = () =>
  useQuery<string | null>({
    queryKey: alertKeys.nextStart(),
    queryFn: () => Promise.resolve(null),
    enabled: false,
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
