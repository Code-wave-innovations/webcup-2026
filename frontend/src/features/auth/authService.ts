import axios from 'axios'
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
export type Inconclusive = 'unknown' | 'noFace' | 'unavailable' | 'mismatch'

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
}

export type RegisterResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; conflict?: boolean }

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
    } catch {
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
 * Used after face identify once the gallery identity has been decoded to an e-mail.
 */
export async function sessionByEmail(identifier: string): Promise<SignInResult> {
  try {
    const { data } = await authHttp.get<AuthResponse>('/auth/by-email', {
      params: { email: resolveAuthEmail(identifier) },
    })
    return { ok: true, session: sessionFromApi(data.token, data.user) }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 404) return { ok: false, inconclusive: 'unknown' }
      if (status === 429) return { ok: false }
    }
    return { ok: false, inconclusive: 'unavailable' }
  }
}

/** Citizen self-registration (D01). */
export async function registerCitizen(input: RegisterInput): Promise<RegisterResult> {
  try {
    const { data } = await authHttp.post<AuthResponse>('/auth/register', {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      name: input.name.trim(),
      last_name: input.last_name.trim(),
    })
    return { ok: true, session: sessionFromApi(data.token, data.user) }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 409) return { ok: false, error: 'Un compte existe déjà avec cet e-mail.', conflict: true }
      const message = (error.response?.data as { message?: string } | undefined)?.message
      return { ok: false, error: message || "Impossible de créer le compte pour l'instant." }
    }
    return { ok: false, error: 'Le serveur ne répond pas.' }
  }
}
