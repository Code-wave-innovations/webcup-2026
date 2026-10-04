import { useLocation } from 'react-router'
import { useSessionUser } from '../../api/session'
import type { Role, User } from '../../api/types'
import type { Persona } from '../mocks/types'

/** The space is decided by the URL (/agent/* or /admin/*); `RequireStaff` checks the role may open it. */
export function usePersona(): Persona {
  return useLocation().pathname.startsWith('/admin') ? 'ADMIN' : 'AGENT'
}

/** Only rendered for a moment while a sign-out redirects to the login page. */
const SIGNED_OUT: User = {
  id: 0,
  created_at: '',
  updated_at: '',
  email: '',
  name: '',
  last_name: '',
  phone: null,
  address: null,
  district_id: null,
  role: 'AGENT',
  locale: 'fr',
  is_vulnerable: false,
  is_active: false,
  onboarding_completed: false,
  preferences: null,
  last_login_at: null,
}

/** The signed-in staff member (the screens live under `RequireStaff`). */
export function useActor(): User {
  return useSessionUser() ?? SIGNED_OUT
}

export const homePath = (persona: Persona) => (persona === 'ADMIN' ? '/admin' : '/agent')

/** The space a role lands on: admins on the administration, agents on their workspace. */
export const personaOf = (role: Role): Persona => (role === 'ADMIN' ? 'ADMIN' : 'AGENT')

/** /agent/connexion?retour=…&expiree=1 */
export function loginPath(persona: Persona, retour?: string, ended: 'expired' | 'revoked' | null = null): string {
  const params = new URLSearchParams()
  if (retour) params.set('retour', retour)
  if (ended) params.set('expiree', ended === 'revoked' ? 'revoquee' : '1')
  const query = params.toString()
  return `${homePath(persona)}/connexion${query ? `?${query}` : ''}`
}

/**
 * Where to go after signing in: the requested page when the role may open it (never another site,
 * never the login page), otherwise the home of the role's space.
 */
export function destinationAfterLogin(role: Role, retour: string | null): string {
  const home = homePath(personaOf(role))
  if (!retour || !/^\/(agent|admin)(\/|$|\?)/.test(retour) || /^\/(agent|admin)\/connexion/.test(retour)) return home
  if (retour.startsWith('/admin') && role !== 'ADMIN') return home
  return retour
}
