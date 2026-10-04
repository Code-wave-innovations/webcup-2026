import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { catalogueFromSnapshot, readEssential, restored } from './essentialCache'
import { homeKeys } from './home'
import { http } from './client'
import { interruptionKeys } from './interruptions'
import { queryClient, REFRESH } from './queryClient'
import type { CityService, HomePreview, Paginated, ServiceCategory, ServiceDetail, ServiceImpact, ServiceInput, ServiceInterruption } from './types'

// D05 / F28 / F63 / F64: the service catalogue (/api/services), written by admins

export const serviceKeys = {
  all: ['services'] as const,
  admin: () => [...serviceKeys.all, 'admin'] as const,
  catalogue: (filters: CatalogueFilters) => [...serviceKeys.all, 'catalogue', filters] as const,
  detail: (slug: string) => [...serviceKeys.all, 'detail', slug] as const,
  impact: (id: number) => [...serviceKeys.all, 'impact', id] as const,
  categories: () => ['service-categories'] as const,
  home: () => homeKeys.all,
}

export interface CatalogueFilters {
  /** category slug; null: every category */
  category: string | null
  /** F32: name, summary, keywords and category */
  q?: string
  limit?: number
}

/** D05 / F28: the active services as citizens see them, featured first then by priority and views */
export const useCatalogue = ({ category, q, limit = 50 }: CatalogueFilters) => {
  const snap = readEssential()
  return useQuery({
    queryKey: serviceKeys.catalogue({ category, q: q || undefined, limit }),
    queryFn: () =>
      http.get<Paginated<CityService>>('/services', { params: { category: category ?? undefined, q: q || undefined, limit } }).then((r) => r.data),
    // switching category keeps the previous tiles on screen until the new ones arrive
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH.catalogue,
    ...restored(catalogueFromSnapshot(snap, { category, q, limit })),
  })
}

/** D05 / F38: one service with its procedures; each fetch counts as a view (F28) */
export const useService = (slug: string | null) =>
  useQuery({
    queryKey: serviceKeys.detail(slug ?? ''),
    queryFn: () => http.get<ServiceDetail>(`/services/${slug}`).then((r) => r.data),
    enabled: slug !== null,
    staleTime: 60_000,
  })

/** Every service, withdrawn ones included (staff) */
export const useAdminServices = (enabled = true) =>
  useQuery({
    queryKey: serviceKeys.admin(),
    queryFn: () => http.get<Paginated<CityService>>('/services', { params: { include_inactive: true, limit: 100 } }).then((r) => r.data.data),
    enabled,
  })

/** Active catalogue for citizen forms (D04 contact service picker). */
export const usePublicServices = () => {
  const snap = readEssential()
  return useQuery({
    queryKey: [...serviceKeys.all, 'public'] as const,
    queryFn: () => http.get<Paginated<CityService>>('/services', { params: { limit: 100 } }).then((r) => r.data.data),
    staleTime: 5 * 60_000,
    ...restored(snap?.serviceList),
  })
}

export const useServiceCategories = () => {
  const snap = readEssential()
  return useQuery({
    queryKey: serviceKeys.categories(),
    queryFn: () => http.get<ServiceCategory[]>('/service-categories').then((r) => r.data),
    staleTime: 10 * 60_000,
    ...restored(snap?.categories),
  })
}

/** F28: what citizens see on the home page, exactly as the server orders it */
export const useHomePreview = () =>
  useQuery({
    queryKey: serviceKeys.home(),
    queryFn: () => http.get<HomePreview>('/home').then((r) => r.data),
  })

export const useServiceImpact = (id: number | null) =>
  useQuery({
    queryKey: serviceKeys.impact(id ?? 0),
    queryFn: () => http.get<ServiceImpact>(`/services/${id}/impact`).then((r) => r.data),
    enabled: id !== null,
  })

const refreshCatalogue = () => {
  void queryClient.invalidateQueries({ queryKey: serviceKeys.all })
  void queryClient.invalidateQueries({ queryKey: serviceKeys.home() })
  void queryClient.invalidateQueries({ queryKey: interruptionKeys.all })
}

/** Applied at once in the list (star, priority, catalogue), rolled back if the server refuses. */
export const useUpdateService = () =>
  useMutation({
    mutationFn: ({ id, ...changes }: ServiceInput & { id: number }) => http.patch<CityService>(`/services/${id}`, changes).then((r) => r.data),
    onMutate: async ({ id, ...changes }) => {
      await queryClient.cancelQueries({ queryKey: serviceKeys.admin() })
      const previous = queryClient.getQueryData<CityService[]>(serviceKeys.admin())
      if (previous) queryClient.setQueryData(serviceKeys.admin(), previous.map((s) => (s.id === id ? { ...s, ...changes } : s)))
      return { previous }
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(serviceKeys.admin(), context.previous)
    },
    onSettled: refreshCatalogue,
  })

export const useCreateService = () =>
  useMutation({
    mutationFn: (input: ServiceInput & { name: string; summary: string }) => http.post<CityService>('/services', input).then((r) => r.data),
    onSuccess: refreshCatalogue,
  })

/** F63: cut now (admin) */
export const useDisableService = () =>
  useMutation({
    mutationFn: ({ id, ...input }: { id: number; reason: string; alternative?: string | null; back_at?: string | null; notify_open_requests?: boolean }) =>
      http
        .post<{ interruption: ServiceInterruption; notified: number; notified_appointments: number; notified_requests: number }>(`/services/${id}/disable`, input)
        .then((r) => r.data),
    onSuccess: refreshCatalogue,
  })

/** F63: back now (admin) */
export const useEnableService = () =>
  useMutation({
    mutationFn: (id: number) => http.post<{ ended: number }>(`/services/${id}/enable`).then((r) => r.data),
    onSuccess: refreshCatalogue,
  })
