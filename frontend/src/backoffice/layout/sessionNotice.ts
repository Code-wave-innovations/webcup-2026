import { create } from 'zustand'

/*
  The API refused the token (expired, account disabled): RequireStaff then sends the person to the
  login page with ?expiree=1, which explains why. A sign-in clears the note.
*/

interface SessionNoticeState {
  expired: boolean
}

export const useSessionNotice = create<SessionNoticeState>()(() => ({ expired: false }))

export const useSessionExpired = () => useSessionNotice((s) => s.expired)

export function noteSessionExpired(): void {
  useSessionNotice.setState({ expired: true })
}

export function clearSessionExpired(): void {
  useSessionNotice.setState({ expired: false })
}
