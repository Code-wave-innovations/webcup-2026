import { describe, expect, it } from 'vitest'
import { destinationAfterLogin } from './persona'

describe('destinationAfterLogin', () => {
  it('always lands an admin on the administration, whichever login page they used', () => {
    expect(destinationAfterLogin('ADMIN', null)).toBe('/admin')
  })

  it('always sends an agent to the agent home', () => {
    expect(destinationAfterLogin('AGENT', null)).toBe('/agent')
  })

  it('honours a retour only inside the role’s own space', () => {
    expect(destinationAfterLogin('ADMIN', '/admin/utilisateurs')).toBe('/admin/utilisateurs')
    expect(destinationAfterLogin('ADMIN', '/agent/demandes')).toBe('/admin')
    expect(destinationAfterLogin('AGENT', '/agent/demandes?statut=SUBMITTED')).toBe('/agent/demandes?statut=SUBMITTED')
    expect(destinationAfterLogin('AGENT', '/admin/utilisateurs')).toBe('/agent')
  })

  it('never goes back to a login page or another site', () => {
    expect(destinationAfterLogin('ADMIN', '/admin/connexion')).toBe('/admin')
    expect(destinationAfterLogin('ADMIN', 'https://evil.example/admin')).toBe('/admin')
    expect(destinationAfterLogin('ADMIN', '/administration')).toBe('/admin')
  })
})
