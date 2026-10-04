import { useMutation, useQuery } from '@tanstack/react-query'
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { http } from './client'
import { queryClient } from './queryClient'
import { replaceToken, setSessionUser } from './session'
import type { MySecurity, PasskeyInfo, TwoFactorSetup, User } from './types'

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
  'two_factor_enabled_at',
] as const satisfies readonly (keyof User)[]

/** GET /api/me adds counters to the account; the session only keeps the account itself. */
const toSessionUser = (me: User): User => Object.fromEntries(USER_KEYS.map((key) => [key, me[key]])) as unknown as User

/** Refreshes the session's copy of the account, so a role change shows without signing in again. */
export const useMe = (enabled = true) =>
  useQuery({
    queryKey: meKeys.all,
    queryFn: async () => {
      const me = (await http.get<User>('/me')).data
      setSessionUser(toSessionUser(me))
      return me
    },
    enabled,
    staleTime: 5 * 60_000,
  })

/* ─── BO-05: own sign-in security (« Mon compte ») ───────────────────────── */

export const mySecurityKeys = { all: ['me', 'security'] as const }

export const useMySecurity = () =>
  useQuery({
    queryKey: mySecurityKeys.all,
    queryFn: () => http.get<MySecurity>('/me/security').then((r) => r.data),
  })

const refreshSecurity = () => void queryClient.invalidateQueries({ queryKey: mySecurityKeys.all })

export const useUpdateMe = () =>
  useMutation({
    mutationFn: (changes: Partial<Pick<User, 'name' | 'last_name' | 'phone'>>) => http.patch<User>('/me', changes).then((r) => r.data),
    onSuccess: (user) => {
      setSessionUser(toSessionUser(user))
      void queryClient.invalidateQueries({ queryKey: meKeys.all })
    },
  })

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) => http.patch('/me/password', input).then((r) => r.data),
  })

export const useSetupMyTwoFactor = () =>
  useMutation({ mutationFn: () => http.post<TwoFactorSetup>('/me/2fa/setup').then((r) => r.data) })

/** Returns the recovery codes, shown once */
export const useEnableMyTwoFactor = () =>
  useMutation({
    mutationFn: (code: string) => http.post<{ enabled: true; recovery_codes: string[] }>('/me/2fa/enable', { code }).then((r) => r.data),
    onSuccess: refreshSecurity,
  })

export const useDisableMyTwoFactor = () =>
  useMutation({
    mutationFn: (input: { password: string; code: string }) => http.post('/me/2fa/disable', input).then((r) => r.data),
    onSuccess: refreshSecurity,
  })

export const useForgetDevice = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/me/devices/${id}`).then((r) => r.data),
    onSuccess: refreshSecurity,
  })

/** Signs out every other device; this session goes on with the new token */
export const useRevokeMySessions = () =>
  useMutation({
    mutationFn: () => http.post<{ token: string }>('/me/sessions/revoke').then((r) => r.data),
    onSuccess: ({ token }) => {
      replaceToken(token)
      refreshSecurity()
    },
  })

/** D02: creates a passkey on this device (the browser asks for the fingerprint or PIN) */
export const useAddPasskey = () =>
  useMutation({
    mutationFn: async (label: string) => {
      const { options, challenge_token } = (
        await http.post<{ options: PublicKeyCredentialCreationOptionsJSON; challenge_token: string }>('/me/passkeys/register/options')
      ).data
      const response = await startRegistration({ optionsJSON: options })
      return (await http.post<PasskeyInfo>('/me/passkeys/register/verify', { challenge_token, response, label })).data
    },
    onSuccess: refreshSecurity,
  })

export const useDeletePasskey = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/me/passkeys/${id}`).then((r) => r.data),
    onSuccess: refreshSecurity,
  })
