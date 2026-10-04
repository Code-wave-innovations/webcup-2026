import { useSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'

/** The JWT of this visit: the airlock stores it on the film session, the back-office on the API session. */
export function reportToken(): string | null {
  return useAuthStore.getState().session?.token ?? useSessionStore.getState().token
}
