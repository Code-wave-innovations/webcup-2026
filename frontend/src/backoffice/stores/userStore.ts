import { create } from 'zustand'
import { ALL_USERS } from '../mocks/people'
import type { Role, User } from '../mocks/types'
import { ROLE_LABEL } from '../lib/labels'
import { recordAudit } from './auditStore'
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

export function setActive(id: number, active: boolean, actorId: number) {
  const user = find(id)
  if (!user) return
  patch(id, { is_active: active })
  recordAudit({
    actor_id: actorId,
    action: active ? 'user.updated' : 'user.deactivated',
    entity: 'User',
    entity_id: id,
    entity_label: label(user),
    changes: [{ field: 'is_active', before: String(user.is_active), after: String(active) }],
  })
  toast(active ? `${label(user)} réactivé·e` : `${label(user)} désactivé·e`, active ? 'ok' : 'alert')
}

export function unlockLogin(id: number, actorId: number) {
  const user = find(id)
  if (!user) return
  patch(id, { login_locked: false })
  recordAudit({
    actor_id: actorId,
    action: 'user.unlocked',
    entity: 'User',
    entity_id: id,
    entity_label: label(user),
    changes: [{ field: 'verrouillage', before: 'verrouillé', after: 'déverrouillé' }],
  })
  toast(`Connexion déverrouillée pour ${label(user)}`)
}

export function changeRole(id: number, role: Role, actorId: number) {
  const user = find(id)
  if (!user || user.role === role) return
  patch(id, { role })
  recordAudit({
    actor_id: actorId,
    action: 'user.role_changed',
    entity: 'User',
    entity_id: id,
    entity_label: label(user),
    changes: [{ field: 'role', before: user.role, after: role }],
  })
  toast(`${label(user)} est maintenant ${ROLE_LABEL[role].toLowerCase()}`, 'info')
}

export function updateProfile(id: number, change: Pick<Partial<User>, 'phone' | 'address' | 'district_id' | 'is_vulnerable'>, actorId: number) {
  const user = find(id)
  if (!user) return
  patch(id, change)
  recordAudit({
    actor_id: actorId,
    action: 'user.updated',
    entity: 'User',
    entity_id: id,
    entity_label: label(user),
    changes: Object.entries(change).map(([field, value]) => ({
      field,
      before: String(user[field as keyof User] ?? '—'),
      after: String(value ?? '—'),
    })),
  })
  toast('Profil mis à jour')
}

export function createStaff(input: { name: string; last_name: string; email: string; role: Role }, actorId: number) {
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
  recordAudit({
    actor_id: actorId,
    action: 'user.created',
    entity: 'User',
    entity_id: user.id,
    entity_label: label(user),
    changes: [{ field: 'role', before: null, after: input.role }],
  })
  toast(`Compte ${ROLE_LABEL[input.role].toLowerCase()} créé pour ${label(user)}`)
}
