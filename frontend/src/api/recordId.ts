import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient } from './queryClient'
import { auditKeys } from './audit'
import type { Paginated } from './types'

// The catalogue, account and request screens still edit a local copy. The journal
// is keyed by the database id, so these lookups follow a stable natural key.

type Kind = 'CityService' | 'User' | 'CitizenRequest'

const serviceIds = new Map<string, number>()
const priorityTails = new Map<string, Promise<void>>()

async function loadServiceIds() {
  const response = await http.get<Paginated<{ id: number; slug: string }>>('/services', {
    params: { limit: 100, include_inactive: 1 },
  })
  for (const row of response.data.data) serviceIds.set(row.slug, row.id)
}

async function serviceIdBySlug(slug: string) {
  const known = serviceIds.get(slug)
  if (known) return known
  await loadServiceIds()
  const id = serviceIds.get(slug)
  if (!id) throw new Error('Ce service n’est pas dans le catalogue en ligne.')
  return id
}

/** Writes the priority on the real service (matched by slug) and refreshes the journal. */
export function setServicePriority(slug: string, priority: number) {
  const run = async () => {
    const id = await serviceIdBySlug(slug)
    await http.patch(`/services/${id}`, { priority })
    void queryClient.invalidateQueries({ queryKey: auditKeys.all })
  }
  const next = (priorityTails.get(slug) ?? Promise.resolve()).then(run, run)
  priorityTails.set(slug, next)
  return next
}

export const useRecordId = (entity: Kind, match: string) =>
  useQuery({
    queryKey: ['record-id', entity, match],
    enabled: match.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<number | null> => {
      if (entity === 'CityService') {
        try {
          return await serviceIdBySlug(match)
        } catch (error) {
          if (error instanceof Error && error.message === 'Ce service n’est pas dans le catalogue en ligne.') return null
          throw error
        }
      }
      if (entity === 'User') {
        const response = await http.get<Paginated<{ id: number; email: string }>>('/users', {
          params: { q: match, limit: 20 },
        })
        return response.data.data.find((row) => row.email === match)?.id ?? null
      }
      const response = await http.get<Paginated<{ id: number; reference: string }>>('/requests', {
        params: { q: match, limit: 20 },
      })
      return response.data.data.find((row) => row.reference === match)?.id ?? null
    },
  })
