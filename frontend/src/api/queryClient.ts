import { QueryClient } from '@tanstack/react-query'
import { isApiError } from './errors'

/**
 * Reference refresh intervals (ms) for the data that must look live. Polling stands in for push:
 * the API runs behind Passenger on cPanel. TanStack Query pauses them while the tab is hidden.
 */
export const REFRESH = {
  notifications: 30_000,
  alerts: 60_000,
  dashboard: 30_000,
  audit: 15_000,
  terraNova: 60_000,
  openRequest: 30_000,
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // one retry for network and server errors; a 4xx will not change by asking again
      retry: (failureCount, error) => failureCount < 1 && !(isApiError(error) && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})
