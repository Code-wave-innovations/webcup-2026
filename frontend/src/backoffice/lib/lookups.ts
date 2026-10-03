import { useMemo } from 'react'
import { CATEGORIES } from '../mocks/catalog'
import { DISTRICTS } from '../mocks/people'
import type { User } from '../mocks/types'
import { useCatalogStore } from '../stores/catalogStore'
import { useUserStore } from '../stores/userStore'

export function useUsersById(): Map<number, User> {
  const users = useUserStore((s) => s.users)
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
}

export function useServiceName(): (id: number | null) => string {
  const services = useCatalogStore((s) => s.services)
  return useMemo(() => {
    const byId = new Map(services.map((s) => [s.id, s.name]))
    return (id) => (id === null ? '—' : (byId.get(id) ?? '—'))
  }, [services])
}

export const districtName = (id: number | null) => DISTRICTS.find((d) => d.id === id)?.name ?? '—'
export const categoryName = (id: number) => CATEGORIES.find((c) => c.id === id)?.name ?? '—'
export const fullName = (user: Pick<User, 'name' | 'last_name'> | undefined) => (user ? `${user.name} ${user.last_name}` : '—')
