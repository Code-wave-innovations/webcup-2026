import { create } from 'zustand'
import { ALL_USERS } from '../mocks/people'
import type { Role, User } from '../mocks/types'
import { ROLE_LABEL } from '../lib/labels'
import { toast } from './toastStore'

interface UserState {
  users: User[]
}

export const useUserStore = create<UserState>()(() => ({ users: ALL_USERS }))

let nextId = 100

const label = (u: User) => `${u.name} ${u.last_name}`
const find = (id: number) => useUserStore.getState().users.find((u) => u.id === id)
const patch = (id: number, change: Partial<User>) =>
  useUserStore.setState((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...change } : u)) }))

/* Simulated account administration (F34, D08). Each maps to PATCH/POST /api/users. */

export function setActive(id: number, active: boolean) {
  const user = find(id)
  if (!user) return
  patch(id, { is_active: active })
  toast(active ? `${label(user)} réactivé·e` : `${label(user)} désactivé·e`, active ? 'ok' : 'alert')
}

export function unlockLogin(id: number) {
  const user = find(id)
  if (!user) return
  patch(id, { login_locked: false })
  toast(`Connexion déverrouillée pour ${label(user)}`)
}

export function changeRole(id: number, role: Role) {
  const user = find(id)
  if (!user || user.role === role) return
  patch(id, { role })
  toast(`${label(user)} est maintenant ${ROLE_LABEL[role].toLowerCase()}`, 'info')
}

export function updateProfile(id: number, change: Pick<Partial<User>, 'phone' | 'address' | 'district_id' | 'is_vulnerable'>) {
  const user = find(id)
  if (!user) return
  patch(id, change)
  toast('Profil mis à jour')
}

export function createStaff(input: { name: string; last_name: string; email: string; role: Role }) {
  const user: User = {
    id: nextId++,
    ...input,
    phone: null,
    address: null,
    district_id: null,
    locale: 'fr',
    is_vulnerable: false,
    is_active: true,
    onboarding_completed: false,
    created_at: new Date().toISOString(),
    last_login_at: null,
  }
  useUserStore.setState((s) => ({ users: [user, ...s.users] }))
  toast(`Compte ${ROLE_LABEL[input.role].toLowerCase()} créé pour ${label(user)}`)
}
