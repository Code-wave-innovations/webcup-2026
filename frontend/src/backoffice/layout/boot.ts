import { matchesQuery, REDUCED_MOTION_QUERY } from '../../hooks/useMediaQuery'
import type { Persona } from '../mocks/types'

// The boot sequence plays once per browser session and space, and again after each sign-in.

const KEY = 'bo-boot'
const PERSONAS: Persona[] = ['AGENT', 'ADMIN']

export function shouldBoot(persona: Persona): boolean {
  if (matchesQuery(REDUCED_MOTION_QUERY)) return false
  try {
    return sessionStorage.getItem(`${KEY}-${persona}`) !== 'done'
  } catch {
    return true
  }
}

export function markBooted(persona: Persona): void {
  try {
    sessionStorage.setItem(`${KEY}-${persona}`, 'done')
  } catch {
    /* private mode: the boot simply plays again next time */
  }
}

/** After a sign-in, the uplink line greets the person who just signed in. */
export function replayBoot(): void {
  try {
    for (const persona of PERSONAS) sessionStorage.removeItem(`${KEY}-${persona}`)
  } catch {
    /* nothing stored, nothing to clear */
  }
}
