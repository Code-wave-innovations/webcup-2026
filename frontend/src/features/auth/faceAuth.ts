import axios from 'axios'
import { enrollFrames, identifyFrame } from '../../hooks/useFaceApi'
import { toSession, type Inconclusive, type SignInResult } from './authService'
import { DEMO_ACCOUNTS, type Account } from './demoAccounts'

/** Recognises a face against the gallery of the face engine (`face-recognitions/`), and links a face to an account. */
export interface FaceAuthService {
  identify(frame: Blob): Promise<SignInResult>
  /** Enrols the frames under the account; resolves true once the face is linked. */
  link(accountId: string, frames: Blob[]): Promise<boolean>
}

/** The account a gallery identity belongs to: faces are enrolled under the account's short identifier. */
export function accountForIdentity(identity: string | null | undefined): Account | undefined {
  if (!identity) return undefined
  return Object.values(DEMO_ACCOUNTS).find((account) => account.id === identity)
}

/** What a failed call to the face engine means: 404 an unknown face, 400 no usable face, anything else no service. */
export function faceFailure(error: unknown): Inconclusive {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  if (status === 404) return 'unknown'
  if (status === 400) return 'noFace'
  return 'unavailable'
}

/** A face that matches no account, or is not recognised at all, is never a refusal: it can still be linked. */
export const faceAuthService: FaceAuthService = {
  async identify(frame) {
    try {
      const account = accountForIdentity((await identifyFrame(frame)).identity)
      return account ? { ok: true, session: toSession(account) } : { ok: false, inconclusive: 'unknown' }
    } catch (error) {
      return { ok: false, inconclusive: faceFailure(error) }
    }
  },
  async link(accountId, frames) {
    try {
      return !!(await enrollFrames(accountId, frames)).committed
    } catch {
      return false
    }
  },
}
