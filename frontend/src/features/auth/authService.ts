import { DEMO_ACCOUNTS, type Account, type Role } from './demoAccounts'

export interface Session {
  accountId: string
  name: string
  roleLabel: string
  role: Role
}

export type SignInResult = { ok: true; session: Session } | { ok: false }

/** Checks credentials. Swap the implementation for a server call without touching the interface. */
export interface AuthService {
  signIn(identifier: string, code: string): Promise<SignInResult>
}

export function toSession(account: Account): Session {
  return { accountId: account.id, name: account.name, roleLabel: account.roleLabel, role: account.role }
}

/** Demo: the code is checked in the page. In the real application, the check happens on the server. */
export const demoAuthService: AuthService = {
  async signIn(identifier, code) {
    const account: Account | undefined = Object.values(DEMO_ACCOUNTS).find((a) => a.id === identifier.trim().toLowerCase())
    if (!account || account.code !== code.trim().toUpperCase()) return { ok: false }
    return { ok: true, session: toSession(account) }
  },
}
