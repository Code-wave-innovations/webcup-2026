import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { ClientIpCheck, LoginAttempt, NewDevice, Paginated, SecurityEventKind, SecurityEvents, SecurityOverview } from './types'

// F37 / F53 / F54 / F100: sign-in attacks for the admin page, and the staff security feed

export interface EventFilters {
  days?: number
  limit?: number
  kind?: SecurityEventKind
}

export interface AttemptFilters {
  email?: string
  ip?: string
  success?: boolean
  page?: number
  limit?: number
}

export const securityKeys = {
  all: ['security'] as const,
  overview: () => [...securityKeys.all, 'overview'] as const,
  events: (filters: EventFilters) => [...securityKeys.all, 'events', filters] as const,
  attempts: (filters: AttemptFilters) => [...securityKeys.all, 'attempts', filters] as const,
  newDevices: (hours: number) => [...securityKeys.all, 'new-devices', hours] as const,
  clientIp: () => [...securityKeys.all, 'client-ip'] as const,
}

export const useSecurityOverview = () =>
  useQuery({
    queryKey: securityKeys.overview(),
    queryFn: () => http.get<SecurityOverview>('/security/overview').then((r) => r.data),
    refetchInterval: REFRESH.dashboard,
  })

export const useSecurityEvents = (filters: EventFilters, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: securityKeys.events(filters),
    queryFn: () => http.get<SecurityEvents>('/security/events', { params: filters }).then((r) => r.data),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH.audit,
  })

export const useLoginAttempts = (filters: AttemptFilters) =>
  useQuery({
    queryKey: securityKeys.attempts(filters),
    queryFn: () => http.get<Paginated<LoginAttempt>>('/security/login-attempts', { params: filters }).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH.dashboard,
  })

export const useNewDevices = (hours = 24) =>
  useQuery({
    queryKey: securityKeys.newDevices(hours),
    queryFn: () => http.get<NewDevice[]>('/security/new-devices', { params: { hours } }).then((r) => r.data),
    refetchInterval: REFRESH.dashboard,
  })

/** cPanel check: which client IP the API sees (TRUST_PROXY) */
export const useClientIp = () =>
  useQuery({
    queryKey: securityKeys.clientIp(),
    queryFn: () => http.get<ClientIpCheck>('/security/client-ip').then((r) => r.data),
    staleTime: Infinity,
  })
