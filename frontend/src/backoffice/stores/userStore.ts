import { create } from 'zustand'
import { ALL_USERS } from '../mocks/people'
import type { User } from '../mocks/types'

interface UserState {
  users: User[]
}

export const useUserStore = create<UserState>()(() => ({ users: ALL_USERS }))

// Read by lib/lookups for the screens still on simulated data (BO-07, BO-08). Account changes go
// through src/api/users.ts.
