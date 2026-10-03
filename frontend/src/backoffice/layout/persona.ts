import { useLocation } from 'react-router'
import { STAFF } from '../mocks/people'
import type { Persona, User } from '../mocks/types'

/** Demo identities for each space, until the shell is wired to /api/auth and /api/me. */
export const PERSONA_USER: Record<Persona, User> = {
  AGENT: STAFF[1],
  ADMIN: STAFF[0],
}

/** The space is decided by the URL: /agent/* or /admin/*. */
export function usePersona(): Persona {
  return useLocation().pathname.startsWith('/admin') ? 'ADMIN' : 'AGENT'
}

/** The signed-in staff member (simulated): author of every simulated action and audit entry. */
export function useActor(): User {
  return PERSONA_USER[usePersona()]
}

export const homePath = (persona: Persona) => (persona === 'ADMIN' ? '/admin' : '/agent')
