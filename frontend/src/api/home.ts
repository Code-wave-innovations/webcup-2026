import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { Home } from './types'

// D07: the home page in one call (GET /api/home); the light version (F96) reads nothing else on arrival

export const homeKeys = {
  /** shared with `useHomePreview` (back-office), which reads the same response */
  all: ['home'] as const,
}

/** Alerts lead the page, so it refreshes at the alerts' pace. */
export const useHome = () =>
  useQuery({
    queryKey: homeKeys.all,
    queryFn: () => http.get<Home>('/home').then((r) => r.data),
    refetchInterval: REFRESH.alerts,
  })
