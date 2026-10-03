import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { queryClient } from './queryClient'
import type { AuthResponse, Role, User } from './types'

/*
  One session for the three profiles (citizen, agent, admin): the JWT returned by /api/auth/login and
  the account it belongs to, kept in localStorage so the visitor finds their space again (D03).
*/

const STORAGE_KEY = 'nova-auth'

interface SessionState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  setUser: (user: User) => void
  clear: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: STORAGE_KEY, storage: createJSONStorage(() => localStorage), partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
)

export const useSessionUser = () => useSessionStore((s) => s.user)
export const useRole = (): Role | null => useSessionStore((s) => s.user?.role ?? null)
export const useSignedIn = () => useSessionStore((s) => s.token !== null)

export const isStaffRole = (role: Role | null | undefined) => role === 'AGENT' || role === 'ADMIN'

/**
 * Cached answers belonged to the previous account: drop the unused ones, and reload the ones on screen
 * with the new identity (`clear()` would leave the screens' queries pending forever).
 */
function resetServerCache(): void {
  queryClient.removeQueries({ type: 'inactive' })
  void queryClient.resetQueries({ type: 'active' })
}

/** Opens the session after a login or a registration. */
export function signIn(auth: AuthResponse): void {
  useSessionStore.getState().setSession(auth.token, auth.user)
  resetServerCache()
}

/** Closes the session. */
export function signOut(): void {
  useSessionStore.getState().clear()
  resetServerCache()
}

export const SESSION_EXPIRED_EVENT = 'nova:session-expired'

/** Called by the HTTP client when the API refuses the token: each space redirects or warns. */
export function expireSession(): void {
  if (!useSessionStore.getState().token) return
  signOut()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export function onSessionExpired(listener: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}

// Signing in or out in another tab applies here too
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) void useSessionStore.persist.rehydrate()
  })
}
