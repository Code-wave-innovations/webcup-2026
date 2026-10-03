import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { InterruptionScope, ServiceInterruption } from './types'

// F38: maintenance and incidents of the services (GET /api/service-interruptions, public)

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
