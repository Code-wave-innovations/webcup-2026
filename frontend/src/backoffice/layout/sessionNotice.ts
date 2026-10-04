import { create } from 'zustand'
import type { SessionEndReason } from '../../api/session'

/*
  The API refused the token (expired, account disabled) or every device was signed out: RequireStaff
  then sends the person to the login page with ?expiree=1 (or =revoquee), which explains why.
  A sign-in clears the note.
*/

interface SessionNoticeState {
  reason: SessionEndReason | null
}

export const useSessionNotice = create<SessionNoticeState>()(() => ({ reason: null }))

export const useSessionExpired = () => useSessionNotice((s) => s.reason)

export function noteSessionExpired(reason: SessionEndReason = 'expired'): void {
  useSessionNotice.setState({ reason })
}

export function clearSessionExpired(): void {
  useSessionNotice.setState({ reason: null })
}
