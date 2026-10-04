import { describe, expect, it } from 'vitest'
import { citizenLink } from './links'

describe('citizenLink', () => {
  it('opens the line on the transport screen (F36)', () => {
    expect(citizenLink('/transport/lines/T1')).toBe('/ville/transports?ligne=T1')
  })

  it('opens an announcement', () => {
    expect(citizenLink('/announcements/12')).toBe('/ville/annonces/12')
  })

  it('returns null without a citizen page', () => {
    expect(citizenLink('/requests/4')).toBeNull()
    expect(citizenLink(null)).toBeNull()
  })
})
