import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Session } from './authService'

interface AuthState {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}

/** The signed-in visitor, kept for the browser tab so a reload of /ville stays in the city. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    { name: 'nova-session', storage: createJSONStorage(() => sessionStorage), partialize: (s) => ({ session: s.session }) },
  ),
)
