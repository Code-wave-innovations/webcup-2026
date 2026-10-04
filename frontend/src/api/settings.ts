import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import type { PlatformSettings, SettingsAdminView } from './types'

// D07 / D08: platform settings (GET /api/settings/public, GET/PATCH /api/settings for admins)

export const settingsKeys = {
  all: ['settings'] as const,
  public: () => [...settingsKeys.all, 'public'] as const,
  admin: () => [...settingsKeys.all, 'admin'] as const,
}

/** What the citizen space needs: home blocks, registrations, maintenance, contacts. */
export const usePublicSettings = () =>
  useQuery({
    queryKey: settingsKeys.public(),
    queryFn: () => http.get<PlatformSettings>('/settings/public').then((r) => r.data),
    staleTime: 60_000,
    refetchInterval: REFRESH.catalogue,
  })

export const useAdminSettings = () =>
  useQuery({
    queryKey: settingsKeys.admin(),
    queryFn: () => http.get<SettingsAdminView>('/settings').then((r) => r.data),
  })

/** Applied at once on screen, rolled back if the server refuses. */
export const useUpdateSettings = () =>
  useMutation({
    mutationFn: (patch: Partial<PlatformSettings>) => http.patch<SettingsAdminView>('/settings', patch).then((r) => r.data),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.admin() })
      const previous = queryClient.getQueryData<SettingsAdminView>(settingsKeys.admin())
      if (previous) queryClient.setQueryData(settingsKeys.admin(), { ...previous, settings: { ...previous.settings, ...patch } })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKeys.admin(), context.previous)
    },
    onSuccess: (view) => {
      queryClient.setQueryData(settingsKeys.admin(), view)
      void queryClient.invalidateQueries({ queryKey: settingsKeys.public() })
    },
  })
