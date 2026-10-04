import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient } from './queryClient'
import type { ManagedUser, Paginated, Role, StaffMember, User, UserSecurity, UserStats } from './types'

// F34 / D08 / D09: accounts as the staff sees them (/api/users). Agents only reach citizen
// accounts and never their e-mail, password or role; admins reach every account.

export interface UserFilters {
  role?: Role
  q?: string
  is_active?: boolean
  district_id?: number
  page?: number
  limit?: number
}

export interface UserChanges {
  name?: string
  last_name?: string
  phone?: string | null
  address?: string | null
  district_id?: number | null
  is_vulnerable?: boolean
  is_active?: boolean
  /** required to deactivate (kept in the audit log) */
  reason?: string
  /** admin only */
  email?: string
  role?: Role
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  staff: () => [...userKeys.all, 'staff'] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
  detail: (id: number) => [...userKeys.all, 'detail', id] as const,
  security: (id: number) => [...userKeys.all, 'security', id] as const,
}

export const useUsers = (filters: UserFilters) =>
  useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => http.get<Paginated<ManagedUser>>('/users', { params: filters }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

/** Citizens only (what an agent may see), for the citizen directory */
export const useCitizens = (q: string) => useUsers({ role: 'CITIZEN', q: q || undefined, limit: 50 })

/** Who a request can be assigned to: active agents and admins. */
export const useStaff = () =>
  useQuery({
    queryKey: userKeys.staff(),
    queryFn: () => http.get<StaffMember[]>('/users/staff').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

export const useUserStats = (enabled = true) =>
  useQuery({
    queryKey: userKeys.stats(),
    queryFn: () => http.get<UserStats>('/users/stats').then((r) => r.data),
    enabled,
  })

export const useUser = (id: number | null | undefined) =>
  useQuery({
    queryKey: userKeys.detail(id ?? 0),
    queryFn: () => http.get<ManagedUser>(`/users/${id}`).then((r) => r.data),
    enabled: typeof id === 'number' && id > 0,
  })

export const useUserSecurity = (id: number | null | undefined, enabled = true) =>
  useQuery({
    queryKey: userKeys.security(id ?? 0),
    queryFn: () => http.get<UserSecurity>(`/users/${id}/security`).then((r) => r.data),
    enabled: enabled && typeof id === 'number' && id > 0,
  })

const refreshUsers = () => void queryClient.invalidateQueries({ queryKey: userKeys.all })

export const useUpdateUser = () =>
  useMutation({
    mutationFn: ({ id, ...changes }: UserChanges & { id: number }) => http.patch<ManagedUser>(`/users/${id}`, changes).then((r) => r.data),
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.detail(user.id), user)
      refreshUsers()
    },
  })

export const useCreateUser = () =>
  useMutation({
    mutationFn: (input: { name: string; last_name: string; email: string; role: Role; password: string }) =>
      http.post<User>('/users', input).then((r) => r.data),
    onSuccess: refreshUsers,
  })

export const useUnlockUser = () =>
  useMutation({
    mutationFn: (id: number) => http.post<{ unlocked: boolean }>(`/users/${id}/unlock-login`).then((r) => r.data),
    onSuccess: refreshUsers,
  })

export const useDeleteUser = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: refreshUsers,
  })

/* BO-05, admin: sign-in security of an account */

export const useRevokeSessions = () =>
  useMutation({
    mutationFn: (id: number) => http.post(`/users/${id}/revoke-sessions`).then((r) => r.data),
    onSuccess: refreshUsers,
  })

export const useResetTwoFactor = () =>
  useMutation({
    mutationFn: (id: number) => http.post(`/users/${id}/2fa/reset`).then((r) => r.data),
    onSuccess: refreshUsers,
  })

export const useRevokePasskeys = () =>
  useMutation({
    mutationFn: (id: number) => http.delete<{ revoked: number }>(`/users/${id}/passkeys`).then((r) => r.data),
    onSuccess: refreshUsers,
  })
