import axios from 'axios'
import { enrollFrames, identifyFrame } from '../../hooks/useFaceApi'
import { resolveAuthEmail, sessionByEmail, toSession, type Inconclusive, type Session, type SignInResult } from './authService'
import { DEMO_ACCOUNTS, type Account } from './demoAccounts'
import { emailFromFaceIdentity, faceIdentityFromEmail } from './faceIdentity'

/** Recognises a face against the gallery, then opens a session via `GET /api/auth/by-email`. */
export interface FaceAuthService {
  /** `expectedIdentifier` is the e-mail / short id the visitor typed on the login step. */
  identify(frame: Blob, expectedIdentifier: string): Promise<SignInResult>
  /** Links the frames to the account that just signed in (gallery name from its e-mail). */
  link(session: Session, frames: Blob[]): Promise<boolean>
}

/** Demo account matching a gallery identity (short id or encoded e-mail). */
export function accountForIdentity(identity: string | null | undefined): Account | undefined {
  if (!identity) return undefined
  return Object.values(DEMO_ACCOUNTS).find(
    (account) => account.id === identity || faceIdentityFromEmail(account.email) === identity,
  )
}

/** What a failed call to the face engine means: 404 an unknown face, 400 no usable face, anything else no service. */
export function faceFailure(error: unknown): Inconclusive {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  if (status === 404) return 'unknown'
  if (status === 400) return 'noFace'
  return 'unavailable'
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * True when the gallery identity belongs to the same account as the typed identifier.
 * Compares short demo ids, e-mails, and encoded face identities (`user.at.domain`).
 */
export function identityMatchesIdentifier(identity: string, expectedIdentifier: string): boolean {
  const key = normalizeKey(expectedIdentifier)
  const expectedEmail = resolveAuthEmail(expectedIdentifier)
  const expectedFace = faceIdentityFromEmail(expectedEmail)

  if (identity === key || identity === expectedFace) return true

  const demo = accountForIdentity(identity)
  if (demo) return demo.id === key || demo.email === expectedEmail

  const faceEmail = emailFromFaceIdentity(identity)
  return faceEmail === expectedEmail
}

const demoAccount = (identifier: string) => {
  const key = normalizeKey(identifier)
  return Object.values(DEMO_ACCOUNTS).find((a) => a.id === key || a.email === key)
}

/**
 * Face login (D03):
 * 1. `POST /identify` on the face engine (browser → Python)
 * 2. gallery identity must match the typed identifier
 * 3. demo accounts stay local; real accounts open a session via `GET /api/auth/by-email`
 */
export const faceAuthService: FaceAuthService = {
  async identify(frame, expectedIdentifier) {
    try {
      const identity = (await identifyFrame(frame)).identity
      if (!identity) return { ok: false, inconclusive: 'unknown' }
      if (!identityMatchesIdentifier(identity, expectedIdentifier)) return { ok: false, inconclusive: 'mismatch' }

      const demo = accountForIdentity(identity)
      if (demo) return { ok: true, session: toSession(demo) }

      const email = emailFromFaceIdentity(identity) ?? resolveAuthEmail(expectedIdentifier)
      return sessionByEmail(email)
    } catch (error) {
      return { ok: false, inconclusive: faceFailure(error) }
    }
  },
  async link(session, frames) {
    try {
      const key = normalizeKey(session.email ?? session.accountId)
      const demo = demoAccount(key)
      const name = demo
        ? faceIdentityFromEmail(demo.email)
        : faceIdentityFromEmail(key.includes('@') ? key : resolveAuthEmail(key))
      return !!(await enrollFrames(name, frames)).committed
    } catch {
      return false
    }
  },
}
