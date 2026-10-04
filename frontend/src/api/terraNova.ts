import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { isApiError } from './errors'
import { queryClient, REFRESH } from './queryClient'
import type { TerraNovaFeed } from './types'

// D19: the official Terra Nova API, relayed by the server (GET /api/terra-nova/requests, staff only).
// The key stays on the server; it caches the feed 60 s and `?refresh=true` bypasses the cache.

export const terraNovaKeys = {
  all: ['terraNova'] as const,
  feed: () => [...terraNovaKeys.all, 'feed'] as const,
}

const fetchFeed = (refresh: boolean) =>
  http.get<TerraNovaFeed>('/terra-nova/requests', { params: refresh ? { refresh: true } : undefined }).then((r) => r.data)

/** 503: the server has no TERRA_NOVA_API_KEY, which no retry will fix */
const notConfigured = (error: unknown) => isApiError(error) && error.status === 503

export const useTerraNovaFeed = () =>
  useQuery({
    queryKey: terraNovaKeys.feed(),
    queryFn: () => fetchFeed(false),
    // F95: without a key, neither retry nor poll; « Actualiser » still asks again
    retry: (failureCount, error) => failureCount < 1 && !notConfigured(error) && !(isApiError(error) && error.status >= 400 && error.status < 500),
    refetchInterval: (query) => (notConfigured(query.state.error) ? false : REFRESH.terraNova),
  })

/** « Actualiser »: asks the server to fetch the upstream API now. */
export const useRefreshTerraNova = () =>
  useMutation({
    mutationFn: () => fetchFeed(true),
    onSuccess: (feed) => queryClient.setQueryData(terraNovaKeys.feed(), feed),
  })
