import { describe, expect, it } from 'vitest'
import { serviceUsage, type UsageService } from './serviceUsage'

function service(partial: Partial<UsageService> & Pick<UsageService, 'id' | 'name' | 'view_count'>): UsageService {
  return { is_featured: false, is_active: true, ...partial }
}

describe('serviceUsage', () => {
  it('says who residents open most, and that this service is not featured', () => {
    const usage = serviceUsage([
      service({ id: 1, name: 'Centre de santé', view_count: 50 }),
      service({ id: 2, name: 'Transports', view_count: 30, is_featured: true }),
      service({ id: 3, name: 'Eau', view_count: 20, is_featured: true }),
    ])
    expect(usage.ranked.map((item) => item.name)).toEqual(['Centre de santé', 'Transports', 'Eau'])
    expect(usage.ranked[0]?.share).toBe(50)
    expect(usage.reading).toContain('Centre de santé')
    expect(usage.reading).toContain('50 %')
    expect(usage.action).toContain('n’est pas mis en avant')
  })

  it('points at a featured service nobody has opened', () => {
    const usage = serviceUsage([
      service({ id: 1, name: 'État civil', view_count: 10, is_featured: true }),
      service({ id: 2, name: 'Urbanisme', view_count: 0, is_featured: true }),
    ])
    expect(usage.action).toBe('Urbanisme est mis en avant sur l’accueil, sans consultation pour l’instant.')
  })

  it('ignores a withdrawn service and an empty catalogue', () => {
    expect(serviceUsage([service({ id: 1, name: 'Ancien', view_count: 80, is_active: false })]).reading).toBe(
      'Aucune consultation d’habitant pour l’instant.',
    )
    expect(serviceUsage([]).action).toBeNull()
  })
})
