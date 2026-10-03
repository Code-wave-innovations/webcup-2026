import { normalizeIdentifier } from './accessWizard'

/**
 * Gallery identity for face-recognitions: e-mail with `@` → `.at.` so it matches
 * `sanitize_identity_name` (`A-Za-z0-9._-`, max 64).
 */
export function faceIdentityFromEmail(email: string): string {
  return normalizeIdentifier(email).replace(/@/g, '.at.').slice(0, 64)
}

/** Reverse of `faceIdentityFromEmail` when the gallery name was encoded from an e-mail. */
export function emailFromFaceIdentity(identity: string): string | null {
  const idx = identity.indexOf('.at.')
  if (idx <= 0) return null
  return `${identity.slice(0, idx)}@${identity.slice(idx + 4)}`
}
