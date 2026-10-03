import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { useSessionStore } from './session'
import type { User } from './types'

// D03 / D08: the signed-in account, as the server sees it now (role or deactivation may have changed)

export const meKeys = { all: ['me'] as const }

const USER_KEYS = [
  'id',
  'created_at',
  'updated_at',
  'email',
  'name',
  'last_name',
  'phone',
  'address',
  'district_id',
  'role',
  'locale',
  'is_vulnerable',
  'is_active',
  'onboarding_completed',
  'preferences',
  'last_login_at',
] as const satisfies readonly (keyof User)[]

/** GET /api/me adds counters to the account; the session only keeps the account itself. */
const toSessionUser = (me: User): User => Object.fromEntries(USER_KEYS.map((key) => [key, me[key]])) as unknown as User

/** Refreshes the session's copy of the account, so a role change shows without signing in again. */
export const useMe = (enabled = true) =>
  useQuery({
    queryKey: meKeys.all,
    queryFn: async () => {
      const me = (await http.get<User>('/me')).data
      useSessionStore.getState().setUser(toSessionUser(me))
      return me
    },
    enabled,
    staleTime: 5 * 60_000,
  })
