import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { http } from './client'
import type { Paginated, StaffMember, User } from './types'

// F34 / F22: accounts as the staff sees them (GET /api/users, /api/users/staff, /api/users/:id).
// Agents only reach citizen accounts; admins reach every account.

export const userKeys = {
  all: ['users'] as const,
  staff: () => [...userKeys.all, 'staff'] as const,
  citizens: (q: string) => [...userKeys.all, 'citizens', q] as const,
  detail: (id: number) => [...userKeys.all, 'detail', id] as const,
}

/** Who a request can be assigned to: active agents and admins. */
export const useStaff = () =>
  useQuery({
    queryKey: userKeys.staff(),
    queryFn: () => http.get<StaffMember[]>('/users/staff').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

export const useCitizens = (q: string) =>
  useQuery({
    queryKey: userKeys.citizens(q),
    queryFn: () =>
      http.get<Paginated<User>>('/users', { params: { role: 'CITIZEN', q: q || undefined, limit: 50 } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

export const useUser = (id: number | null | undefined) =>
  useQuery({
    queryKey: userKeys.detail(id ?? 0),
    queryFn: () => http.get<User>(`/users/${id}`).then((r) => r.data),
    enabled: typeof id === 'number' && id > 0,
  })
