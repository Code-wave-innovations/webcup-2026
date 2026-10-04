import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCitizenSessionStore } from '../../api/session'
import type { User } from '../../api/types'
import { useAuthStore } from '../auth/authStore'
import { reportToken } from './reportToken'

const memory = new Map<string, string>()

const citizen: User = {
  id: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  email: 'citoyen@novaterra.local',
  name: 'Lucas',
  last_name: 'Martin',
  phone: null,
  address: null,
  district_id: null,
  role: 'CITIZEN',
  locale: 'fr',
  is_vulnerable: false,
  is_active: true,
  onboarding_completed: true,
  preferences: null,
  last_login_at: null,
}

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => memory.get(`s:${key}`) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(`s:${key}`, value)
    },
    removeItem: (key: string) => {
      memory.delete(`s:${key}`)
    },
    clear: () => memory.clear(),
  })
  useCitizenSessionStore.getState().clear()
  useAuthStore.getState().signOut()
})

describe('reportToken', () => {
  it('prefers the citizen JWT over a film session token', () => {
    useAuthStore.getState().signIn({
      accountId: '9',
      name: 'Film',
      roleLabel: 'Habitant·e',
      role: 'resident',
      token: 'film-jwt',
      email: 'film@example.com',
    })
    useCitizenSessionStore.getState().setSession('citizen-jwt', citizen)

    expect(reportToken()).toBe('citizen-jwt')
  })

  it('falls back to the film token only when the citizen slot is empty', () => {
    useAuthStore.getState().signIn({
      accountId: '9',
      name: 'Film',
      roleLabel: 'Habitant·e',
      role: 'resident',
      token: 'film-jwt',
      email: 'film@example.com',
    })

    expect(reportToken()).toBe('film-jwt')
  })

  it('returns null when neither slot has a token', () => {
    expect(reportToken()).toBeNull()
  })
})
