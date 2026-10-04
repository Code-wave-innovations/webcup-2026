import { useCitizenSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'

/**
 * JWT for citizen API calls from the film (reports, …).
 * Prefer `nova-auth-citizen`; film session token is only a last resort (legacy / same login mirrored in authStore).
 */
export function reportToken(): string | null {
  return useCitizenSessionStore.getState().token ?? useAuthStore.getState().session?.token ?? null
}
