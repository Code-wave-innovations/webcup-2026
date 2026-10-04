import { describe, expect, it } from 'vitest'
import type { Availability } from '../../api/types'
import { availabilityView, formatDelay } from './availability'

const brief = { id: 1, type: 'MAINTENANCE', impact: 'UNAVAILABLE', reason: 'Maintenance', alternative: null, starts_at: '2026-10-05T05:00:00.000Z', ends_at: null } as const
const availability = (patch: Partial<Availability>): Availability => ({ status: 'AVAILABLE', current: null, back_at: null, upcoming: [], ...patch }) as Availability

describe('availabilityView', () => {
  it('reads an open service as "Ouvert", with no detail', () => {
    expect(availabilityView(availability({}))).toMatchObject({ tone: 'ok', label: 'Ouvert', detail: null })
  })

  it('announces the next planned interruption of an open service', () => {
    expect(availabilityView(availability({ upcoming: [brief] })).detail).toMatch(/^Interruption prévue /)
  })

  it('tells when an interrupted service comes back, or that nobody knows yet', () => {
    expect(availabilityView(availability({ status: 'UNAVAILABLE', current: brief, back_at: '2026-10-05T12:00:00.000Z' }))).toMatchObject({
      tone: 'alert',
      label: 'Indisponible',
      detail: expect.stringMatching(/^jusqu'au .+ à \d\d:\d\d$/),
    })
    expect(availabilityView(availability({ status: 'DEGRADED', current: brief })).detail).toBe("jusqu'à nouvel ordre")
  })
})

describe('formatDelay', () => {
  it('writes the estimated delay of a procedure', () => {
    expect(formatDelay(null)).toBeNull()
    expect(formatDelay(0)).toBe('Immédiat')
    expect(formatDelay(1)).toBe('≈ 1 jour')
    expect(formatDelay(5)).toBe('≈ 5 jours')
  })
})
