import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import type { Permission } from './types'

// D08 / D09: the roles matrix as the server applies it (GET /api/permissions, read-only)

export const permissionKeys = { all: ['permissions'] as const }

export const usePermissions = () =>
  useQuery({
    queryKey: permissionKeys.all,
    queryFn: () => http.get<Permission[]>('/permissions').then((r) => r.data),
    staleTime: 10 * 60_000,
  })
