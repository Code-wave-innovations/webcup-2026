import { describe, expect, it } from 'vitest'
import { destinationAfterLogin } from './persona'

describe('destinationAfterLogin', () => {
  it('keeps an admin on the agent home when they signed in from the agent space', () => {
    expect(destinationAfterLogin('ADMIN', null, 'AGENT')).toBe('/agent')
  })

  it('lands an admin on the administration when they signed in from that space', () => {
    expect(destinationAfterLogin('ADMIN', null, 'ADMIN')).toBe('/admin')
  })

  it('still sends an agent to the agent home after an admin login attempt', () => {
    expect(destinationAfterLogin('AGENT', null, 'ADMIN')).toBe('/agent')
  })

  it('honours a retour the role may open', () => {
    expect(destinationAfterLogin('ADMIN', '/agent/demandes', 'ADMIN')).toBe('/agent/demandes')
    expect(destinationAfterLogin('AGENT', '/admin/utilisateurs', 'ADMIN')).toBe('/agent')
  })
})
