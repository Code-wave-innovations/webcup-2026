import type { Query, QueryKey } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { queryClient } from './queryClient'
import type { AuthResponse, Role, User } from './types'

/*
  Two JWT slots (same browser can hold both):
  - nova-auth-citizen → habitant, used by /ville, /nova, sas, console citoyenne
  - nova-auth-staff   → AGENT/ADMIN, used by /agent and /admin
  Signing into one space never overwrites the other.
*/

export const CITIZEN_STORAGE_KEY = 'nova-auth-citizen'
export const STAFF_STORAGE_KEY = 'nova-auth-staff'
/** Pre-split single key — migrated once into the matching slot. */
const LEGACY_STORAGE_KEY = 'nova-auth'

interface SessionState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  setUser: (user: User) => void
  clear: () => void
}

const emptySession = (): Omit<SessionState, 'setSession' | 'setUser' | 'clear'> => ({
  token: null,
  user: null,
})

function createSessionStore(storageKey: string) {
  return create<SessionState>()(
    persist(
      (set) => ({
        ...emptySession(),
        setSession: (token, user) => set({ token, user }),
        setUser: (user) => set({ user }),
        clear: () => set(emptySession()),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ token: s.token, user: s.user }),
      },
    ),
  )
}

export const useCitizenSessionStore = createSessionStore(CITIZEN_STORAGE_KEY)
export const useStaffSessionStore = createSessionStore(STAFF_STORAGE_KEY)

/** @deprecated Prefer the citizen/staff stores; kept for gradual call-site updates. */
export const useSessionStore = useCitizenSessionStore

export const isStaffRole = (role: Role | null | undefined) => role === 'AGENT' || role === 'ADMIN'

/** Back-office URL space. */
export const isStaffPath = (pathname: string): boolean =>
  pathname.startsWith('/agent') || pathname.startsWith('/admin')

function migrateLegacyAuth(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { state?: { token?: string | null; user?: User | null } }
    const token = parsed.state?.token
    const user = parsed.state?.user
    if (token && user) {
      if (user.role === 'CITIZEN' && !useCitizenSessionStore.getState().token) {
        useCitizenSessionStore.getState().setSession(token, user)
      } else if (isStaffRole(user.role) && !useStaffSessionStore.getState().token) {
        useStaffSessionStore.getState().setSession(token, user)
      }
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
}

migrateLegacyAuth()

/** Bearer for the current UI space — citizen film ↔ citizen JWT, back-office ↔ staff JWT. */
export function authTokenForSpace(pathname = typeof window !== 'undefined' ? window.location.pathname : '/'): string | null {
  if (isStaffPath(pathname)) return useStaffSessionStore.getState().token
  return useCitizenSessionStore.getState().token
}

export const useCitizenUser = () => useCitizenSessionStore((s) => s.user)
export const useStaffUser = () => useStaffSessionStore((s) => s.user)

export const useAgentUser = () => {
  const user = useStaffUser()
  return user?.role === 'AGENT' ? user : null
}

export const useAdminUser = () => {
  const user = useStaffUser()
  return user?.role === 'ADMIN' ? user : null
}

/** User of the current URL space (staff path → staff slot, else citizen slot). */
export function useSessionUser(): User | null {
  const { pathname } = useLocation()
  const citizen = useCitizenUser()
  const staff = useStaffUser()
  return isStaffPath(pathname) ? staff : citizen
}

export function useRole(): Role | null {
  return useSessionUser()?.role ?? null
}

export function useSignedIn(): boolean {
  return useSessionUser() !== null
}

export const useCitizenSignedIn = () => useCitizenSessionStore((s) => s.token !== null)
export const useStaffSignedIn = () => useStaffSessionStore((s) => s.token !== null)
export const useAgentSignedIn = () => useAgentUser() !== null
export const useAdminSignedIn = () => useAdminUser() !== null

function resetServerCache(): void {
  queryClient.removeQueries({ type: 'inactive' })
  void queryClient.resetQueries({ type: 'active' })
}

/** Data that the API gives without a session, by the first two parts of the query key (`admin` and `impact` are staff views). */
const PUBLIC_QUERY_ROOTS = new Set(['home', 'announcements', 'transit', 'services', 'service-categories', 'settings', 'districts', 'procedures', 'alerts', 'interruptions'])
const STAFF_QUERY_PARTS = new Set(['admin', 'impact', 'audience'])

const isPublicQuery = (key: QueryKey) => PUBLIC_QUERY_ROOTS.has(String(key[0])) && !STAFF_QUERY_PARTS.has(String(key[1]))

/**
 * F95: after a sign-out, only the public data on screen is loaded again. Reloading the rest would send
 * requests without a token, each refused with a 401, while their screens are already leaving behind
 * their guard (RequireStaff, RequireSession). Removing a query does not refetch it.
 */
function dropAccountCache(): void {
  void queryClient.cancelQueries()
  queryClient.removeQueries({ predicate: (query: Query) => !isPublicQuery(query.queryKey) })
  queryClient.removeQueries({ type: 'inactive' })
  void queryClient.resetQueries({ type: 'active' })
}

function storeForRole(role: Role) {
  return role === 'CITIZEN' ? useCitizenSessionStore : useStaffSessionStore
}

/** F37: failed login attempts since last success — shown once on Mon espace after a real API login. */
const FAILED_LOGIN_NOTICE_KEY = 'nova-failed-login-notice'

function rememberFailedLoginNotice(auth: AuthResponse): void {
  if (typeof window === 'undefined') return
  const n = auth.security?.failed_attempts_since_last_login ?? 0
  if (auth.user.role === 'CITIZEN' && n > 0) {
    try {
      sessionStorage.setItem(FAILED_LOGIN_NOTICE_KEY, String(n))
    } catch {
      /* private mode */
    }
  }
}

/** Number of failed attempts reported at the last citizen login, or null if none / already dismissed. */
export function readFailedLoginNotice(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FAILED_LOGIN_NOTICE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function dismissFailedLoginNotice(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FAILED_LOGIN_NOTICE_KEY)
  } catch {
    /* private mode */
  }
}

/** Opens the matching slot; the other space’s session is left untouched. */
export function signIn(auth: AuthResponse): void {
  if (auth.user.role === 'CITIZEN') {
    useCitizenSessionStore.getState().setSession(auth.token, auth.user)
    rememberFailedLoginNotice(auth)
  } else if (isStaffRole(auth.user.role)) {
    useStaffSessionStore.getState().setSession(auth.token, auth.user)
  } else {
    return
  }
  resetServerCache()
}

export function signOutCitizen(): void {
  dismissFailedLoginNotice()
  useCitizenSessionStore.getState().clear()
  dropAccountCache()
}

export function signOutStaff(): void {
  useStaffSessionStore.getState().clear()
  dropAccountCache()
}

/** Signs out the current URL space (or both when `all`). */
export function signOut(scope: 'space' | 'all' = 'space'): void {
  if (scope === 'all') {
    dismissFailedLoginNotice()
    useCitizenSessionStore.getState().clear()
    useStaffSessionStore.getState().clear()
    dropAccountCache()
    return
  }
  if (typeof window !== 'undefined' && isStaffPath(window.location.pathname)) signOutStaff()
  else signOutCitizen()
}

export const SESSION_EXPIRED_EVENT = 'nova:session-expired'

export type SessionEndReason = 'expired' | 'revoked'

/** Ends the session slot that matched the refused Bearer (by current path). */
export function expireSession(reason: SessionEndReason = 'expired'): void {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (isStaffPath(pathname)) {
    if (!useStaffSessionStore.getState().token) return
    signOutStaff()
  } else {
    if (!useCitizenSessionStore.getState().token) return
    signOutCitizen()
  }
  window.dispatchEvent(new CustomEvent<SessionEndReason>(SESSION_EXPIRED_EVENT, { detail: reason }))
}

export function onSessionExpired(listener: (reason: SessionEndReason) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<SessionEndReason>).detail ?? 'expired')
  window.addEventListener(SESSION_EXPIRED_EVENT, handler)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
}

/** BO-05: new token after revoking other devices — staff Mon compte. */
export function replaceToken(token: string): void {
  const { user, setSession } = useStaffSessionStore.getState()
  if (user) setSession(token, user)
}

/** Update the account copy in the slot that matches this user’s role. */
export function setSessionUser(user: User): void {
  const store = storeForRole(user.role)
  if (store.getState().token) store.getState().setUser(user)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === CITIZEN_STORAGE_KEY) void useCitizenSessionStore.persist.rehydrate()
    if (event.key === STAFF_STORAGE_KEY) void useStaffSessionStore.persist.rehydrate()
  })
}
