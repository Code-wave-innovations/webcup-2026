import { DEMO_ACCOUNTS, type Account, type Role } from './demoAccounts'

export interface Session {
  accountId: string
  name: string
  roleLabel: string
  role: Role
}

/**
 * Why a check could not decide (the face engine did not know the face, saw none, or did not answer).
 * Such a failure is not a refusal: it costs no attempt.
 */
export type Inconclusive = 'unknown' | 'noFace' | 'unavailable'

export type SignInResult = { ok: true; session: Session } | { ok: false; inconclusive?: Inconclusive }

/** Checks credentials. Swap the implementation for a server call without touching the interface. */
export interface AuthService {
  signIn(identifier: string, code: string): Promise<SignInResult>
}

export function toSession(account: Account): Session {
  return { accountId: account.id, name: account.name, roleLabel: account.roleLabel, role: account.role }
}

/** A plausible e-mail address (the airlock also accepts the short identifiers). */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim())

/** Round trip of a real check, so the scan is seen. */
const CHECK_MS = 750

/** Demo: the code is checked in the page. In the real application, the check happens on the server. */
export const demoAuthService: AuthService = {
  async signIn(identifier, code) {
    await new Promise((resolve) => setTimeout(resolve, CHECK_MS))
    const key = identifier.trim().toLowerCase()
    const account: Account | undefined = Object.values(DEMO_ACCOUNTS).find((a) => a.id === key || a.email === key)
    if (!account || account.code !== code.trim().toUpperCase()) return { ok: false }
    return { ok: true, session: toSession(account) }
  },
}
