import axios from 'axios'
import { messageFor, toApiError } from '../../api/errors'
import { type FormGuardPayload } from '../security/formGuard'
import { rootApiUrl } from '../../hooks/useHttps'
import { defineMessages, messagesFor } from '../../i18n'
import { DEMO_ACCOUNTS, type Account, type Role, type RoleKey } from './demoAccounts'

const messages = defineMessages(
  {
    triesLeft: (left: number) => ` Encore ${left} essai${left > 1 ? 's' : ''} avant le blocage.`,
    passwordShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    emailTaken: 'Un compte existe déjà avec cet e-mail.',
  },
  {
    triesLeft: (left) => ` ${left} ${left === 1 ? 'try' : 'tries'} left before the code is blocked.`,
    passwordShort: 'The password must be at least 8 characters long.',
    emailTaken: 'An account already exists with this e-mail.',
  },
)

export interface Session {
  accountId: string
  name: string
  /** the role as opened, in French; shown through `sessionRoleLabel` (roleLabel.ts), which follows the language */
  roleLabel: string
  /** which role the label names, so it can be said in English too (absent on sessions saved before D14) */
  roleKey?: RoleKey
  role: Role
  token?: string
  email?: string
  /** Real API login/register: bind into `nova-auth-citizen` / `nova-auth-staff`. */
  auth?: AuthResponse
}

/**
 * Why a check could not decide (the face engine did not know the face, saw none, or did not answer).
 * Such a failure is not a refusal: it costs no attempt.
 */
export type Inconclusive = 'unknown' | 'noFace' | 'unavailable' | 'mismatch' | 'disabled'

export type SignInResult = { ok: true; session: Session } | { ok: false; inconclusive?: Inconclusive }

/** Checks credentials. Swap the implementation for a server call without touching the interface. */
export interface AuthService {
  signIn(identifier: string, code: string): Promise<SignInResult>
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  last_name: string
  district_id: number
}

export type RegisterResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; conflict?: boolean; turnstileRequired?: boolean; retryAfter?: number | null }

interface ApiUser {
  id: number
  email: string
  name: string
  last_name: string
  role: string
}

interface AuthResponse {
  token: string
  user: ApiUser
  /** F37: present on password / face login */
  security?: { failed_attempts_since_last_login: number; new_device?: boolean; device_id?: number }
}

export function toSession(account: Account): Session {
  return { accountId: account.id, name: account.name, roleLabel: account.roleLabel, roleKey: account.role, role: account.role, email: account.email }
}

/** Film chrome session from the citizen JWT slot (DevLogin / API without the demo airlock). */
export function filmSessionFromCitizen(user: { id: number; name: string; email: string }): Session {
  return {
    accountId: String(user.id),
    name: user.name,
    roleLabel: 'Habitant·e',
    roleKey: 'resident',
    role: 'resident',
    email: user.email,
  }
}

export function sessionFromApi(auth: AuthResponse): Session {
  const { token, user } = auth
  const citizen = user.role === 'CITIZEN'
  return {
    accountId: String(user.id),
    name: user.name,
    roleLabel: citizen ? 'Habitante' : user.role === 'ADMIN' ? 'Administration' : 'Agent',
    roleKey: citizen ? 'resident' : user.role === 'ADMIN' ? 'admin' : 'agent',
    role: citizen ? 'resident' : 'council',
    token,
    email: user.email,
    auth,
  }
}

/** A plausible e-mail address (the airlock also accepts the short identifiers). */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim())

const CHECK_MS = 750
const authHttp = axios.create({ baseURL: rootApiUrl })

/** Demo: the code is checked in the page. */
export const demoAuthService: AuthService = {
  async signIn(identifier, code) {
    await new Promise((resolve) => setTimeout(resolve, CHECK_MS))
    const key = identifier.trim().toLowerCase()
    const account: Account | undefined = Object.values(DEMO_ACCOUNTS).find((a) => a.id === key || a.email === key)
    if (!account || account.code !== code.trim().toUpperCase()) return { ok: false }
    return { ok: true, session: toSession(account) }
  },
}

/** Live login: demo accounts stay local; everyone else hits `POST /api/auth/login`. */
export const terraAuthService: AuthService = {
  async signIn(identifier, code) {
    const key = identifier.trim().toLowerCase()
    const demo = Object.values(DEMO_ACCOUNTS).find((a) => a.id === key || a.email === key)
    if (demo) return demoAuthService.signIn(identifier, code)
    try {
      const email = isEmail(key) ? key : `${key}@terra-nova.city`
      const { data } = await authHttp.post<AuthResponse>('/auth/login', { email, password: code })
      return { ok: true, session: sessionFromApi(data) }
    } catch (error) {
      // F34: a suspended account is said plainly (the server only says so after the right password)
      if (toApiError(error).code === 'ACCOUNT_DISABLED') return { ok: false, inconclusive: 'disabled' }
      return { ok: false }
    }
  },
}

/** Short id → `id@terra-nova.city`; e-mail stays an e-mail. */
export function resolveAuthEmail(identifier: string): string {
  const key = identifier.trim().toLowerCase()
  return isEmail(key) ? key : `${key}@terra-nova.city`
}

/** Safe existence check for the airlock (does not issue a session). */
export async function accountExists(identifier: string): Promise<boolean> {
  try {
    const { data } = await authHttp.get<{ exists: boolean }>('/auth/exists', {
      params: { email: resolveAuthEmail(identifier) },
    })
    return !!data.exists
  } catch {
    return false
  }
}

/**
 * Passwordless session via `GET /api/auth/by-email` — same `{ token, user }` body as `POST /auth/login`.
 * Used after the browser identified the face against the face engine.
 */
export async function sessionByEmail(identifier: string): Promise<SignInResult> {
  try {
    const { data } = await authHttp.get<AuthResponse>('/auth/by-email', {
      params: { email: resolveAuthEmail(identifier) },
    })
    return { ok: true, session: sessionFromApi(data) }
  } catch (error) {
    const api = toApiError(error)
    if (api.code === 'ACCOUNT_DISABLED') return { ok: false, inconclusive: 'disabled' }
    if (api.status === 404) return { ok: false, inconclusive: 'unknown' }
    if (api.status === 429) return { ok: false }
    return { ok: false, inconclusive: 'unavailable' }
  }
}

export type RecoverResult = { ok: true; session: Session } | { ok: false; error: string; field?: 'code' | 'password' }

/**
 * F34: back into one's account with the code the city handed over after checking the person's
 * identity. The person chooses the new password; their other devices are signed out.
 */
export async function recoverAccess(identifier: string, code: string, password: string): Promise<RecoverResult> {
  try {
    const { data } = await authHttp.post<AuthResponse>('/auth/recover', { email: resolveAuthEmail(identifier), code, password })
    return { ok: true, session: sessionFromApi(data) }
  } catch (error) {
    const api = toApiError(error)
    if (api.code === 'INVALID_RESET_CODE') {
      const left = (api.details as { remaining_attempts?: number } | undefined)?.remaining_attempts
      return { ok: false, field: 'code', error: `${messageFor(api)}${left !== undefined && left <= 2 ? messagesFor(messages).triesLeft(left) : ''}` }
    }
    if (api.code === 'VALIDATION_ERROR') return { ok: false, field: 'password', error: messagesFor(messages).passwordShort }
    return { ok: false, error: messageFor(api) }
  }
}

/** Citizen self-registration (D01). */
export async function registerCitizen(
  input: RegisterInput & FormGuardPayload,
): Promise<RegisterResult> {
  try {
    const { data } = await authHttp.post<AuthResponse>('/auth/register', {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      name: input.name.trim(),
      last_name: input.last_name.trim(),
      district_id: input.district_id,
      website: input.website,
      form_started_at: input.form_started_at,
      turnstile_token: input.turnstile_token,
    })
    return { ok: true, session: sessionFromApi(data) }
  } catch (error) {
    const api = toApiError(error)
    if (api.status === 409 || api.code === 'CONFLICT') {
      return { ok: false, error: messagesFor(messages).emailTaken, conflict: true }
    }
    if (api.code === 'TURNSTILE_REQUIRED') {
      return { ok: false, error: messageFor(api), turnstileRequired: true }
    }
    if (api.code === 'RATE_LIMITED') {
      return { ok: false, error: messageFor(api), retryAfter: api.retryAfter }
    }
    return { ok: false, error: messageFor(api) }
  }
}
