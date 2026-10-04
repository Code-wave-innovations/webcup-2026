import { QueryClient } from '@tanstack/react-query'
import { isLightScene } from '../a11y/sceneMode'
import { isApiError } from './errors'

/**
 * Reference refresh intervals (ms) for the data that must look live. Polling stands in for push:
 * the API runs behind Passenger on cPanel. TanStack Query pauses them while the tab is hidden.
 */
const BASE_REFRESH = {
  notifications: 30_000,
  /** A new outage must reach the screen quickly; a programmed one also wakes at its start hour. */
  alerts: 15_000,
  dashboard: 30_000,
  /** F95: daily trends and period summaries move slowly; every 30 s they cost the heaviest queries of the API */
  trends: 300_000,
  /** F95: the journal feeds (dashboards, Activité, Journal d'audit) */
  audit: 30_000,
  terraNova: 60_000,
  openRequest: 30_000,
  /** F28 / F38: what the admin puts forward or cuts shows within a minute */
  catalogue: 60_000,
  /** F36: a line reported disrupted shows within a minute, departures stay current */
  transit: 60_000,
  /** F95: reference data that only the staff changes (transit lines, stops, timetables); their own edits invalidate it at once */
  reference: 300_000,
} as const

/** F96: on a limited connection the light version polls three times less often, except the alerts (safety). */
const LIGHT_SLOWDOWN = 3

export const REFRESH: { readonly [K in keyof typeof BASE_REFRESH]: number } = isLightScene
  ? (Object.fromEntries(
      Object.entries(BASE_REFRESH).map(([key, ms]) => [key, key === 'alerts' ? ms : ms * LIGHT_SLOWDOWN]),
    ) as Record<keyof typeof BASE_REFRESH, number>)
  : BASE_REFRESH

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // one retry for network and server errors; a 4xx will not change by asking again
      retry: (failureCount, error) => failureCount < 1 && !(isApiError(error) && error.status >= 400 && error.status < 500),
      // F96: switching apps on a phone must not refetch every screen over a slow network
      refetchOnWindowFocus: !isLightScene,
    },
    mutations: { retry: false },
  },
})
