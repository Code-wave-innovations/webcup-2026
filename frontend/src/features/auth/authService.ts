import axios from 'axios'
import { messageFor, toApiError } from '../../api/errors'
import { type FormGuardPayload } from '../security/formGuard'
import { rootApiUrl } from '../../hooks/useHttps'
import { DEMO_ACCOUNTS, type Account, type Role } from './demoAccounts'

export interface Session {
  accountId: string
  name: string
  roleLabel: string
  role: Role
  token?: string
  email?: string
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
}

export function toSession(account: Account): Session {
  return { accountId: account.id, name: account.name, roleLabel: account.roleLabel, role: account.role, email: account.email }
}

export function sessionFromApi(token: string, user: ApiUser): Session {
  const citizen = user.role === 'CITIZEN'
  return {
    accountId: String(user.id),
    name: user.name,
    roleLabel: citizen ? 'Habitante' : user.role === 'ADMIN' ? 'Administration' : 'Agent',
    role: citizen ? 'resident' : 'council',
    token,
    email: user.email,
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
      return { ok: true, session: sessionFromApi(data.token, data.user) }
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
 * D03 / F34: face sign-in. The picture goes to the API, which asks the face engine whether it is the
 * person behind `email` and only then opens the session: an e-mail alone opens nothing.
 */
export async function faceSignIn(identifier: string, frame: Blob): Promise<SignInResult> {
  const form = new FormData()
  form.append('email', resolveAuthEmail(identifier))
  form.append('image', frame, 'frame.jpg')
  try {
    const { data } = await authHttp.post<AuthResponse>('/auth/face', form)
    return { ok: true, session: sessionFromApi(data.token, data.user) }
  } catch (error) {
    const api = toApiError(error)
    if (api.code === 'FACE_NOT_ENROLLED') return { ok: false, inconclusive: 'unknown' }
    if (api.code === 'FACE_UNUSABLE') return { ok: false, inconclusive: 'noFace' }
    if (api.code === 'ACCOUNT_DISABLED') return { ok: false, inconclusive: 'disabled' }
    // another face counts as a refused attempt, on the server as here
    if (api.code === 'FACE_MISMATCH' || api.status === 429) return { ok: false }
    return { ok: false, inconclusive: 'unavailable' }
  }
}

/** D03: links the face to the account that just signed in (the API checks it is that person's own) */
export async function linkOwnFace(token: string, frames: Blob[]): Promise<boolean> {
  const form = new FormData()
  frames.forEach((frame, i) => form.append(`img${i}`, frame, `frame${i}.jpg`))
  try {
    const { data } = await authHttp.post<{ committed: boolean }>('/me/face', form, { headers: { Authorization: `Bearer ${token}` } })
    return data.committed
  } catch {
    return false
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
    return { ok: true, session: sessionFromApi(data.token, data.user) }
  } catch (error) {
    const api = toApiError(error)
    if (api.code === 'INVALID_RESET_CODE') {
      const left = (api.details as { remaining_attempts?: number } | undefined)?.remaining_attempts
      return { ok: false, field: 'code', error: `${messageFor(api)}${left !== undefined && left <= 2 ? ` Encore ${left} essai${left > 1 ? 's' : ''} avant le blocage.` : ''}` }
    }
    if (api.code === 'VALIDATION_ERROR') return { ok: false, field: 'password', error: 'Le mot de passe doit contenir au moins 8 caractères.' }
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
    return { ok: true, session: sessionFromApi(data.token, data.user) }
  } catch (error) {
    const api = toApiError(error)
    if (api.status === 409 || api.code === 'CONFLICT') {
      return { ok: false, error: 'Un compte existe déjà avec cet e-mail.', conflict: true }
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
