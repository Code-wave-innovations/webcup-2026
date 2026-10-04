import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient } from './queryClient'
import type { Permission, Role } from './types'

// D08 / D09: effective roles matrix (GET) and admin overrides (PATCH)

export const permissionKeys = { all: ['permissions'] as const }

export const usePermissions = () =>
  useQuery({
    queryKey: permissionKeys.all,
    queryFn: () => http.get<Permission[]>('/permissions').then((r) => r.data),
    staleTime: 30_000,
  })

export const useUpdatePermissionRoles = () =>
  useMutation({
    mutationFn: ({ key, roles }: { key: string; roles: Array<Extract<Role, 'AGENT' | 'ADMIN'>> }) =>
      http.patch<Permission>(`/permissions/${encodeURIComponent(key)}`, { roles }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: permissionKeys.all })
    },
  })
