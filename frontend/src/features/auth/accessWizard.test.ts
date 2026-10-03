import { describe, expect, it } from 'vitest'
import {
  lookupAccount,
  normalizeIdentifier,
  sessionFromRegister,
  stepSubtitle,
  stepTitle,
  validateIdentifier,
  validateRegisterNames,
  validateRegisterSecrets,
} from './accessWizard'

describe('accessWizard', () => {
  it('normalizes trim + lower case', () => {
    expect(normalizeIdentifier('  Miora@Terra-Nova.City ')).toBe('miora@terra-nova.city')
  })

  it('validateIdentifier', () => {
    expect(validateIdentifier('')).toBe('empty')
    expect(validateIdentifier('not-an-email@')).toBe('email')
    expect(validateIdentifier('miora')).toBe('ok')
    expect(validateIdentifier('new@terra-nova.city')).toBe('ok')
  })

  it('lookupAccount routes demo emails and ids to login', () => {
    expect(lookupAccount('miora@terra-nova.city')).toBe('login')
    expect(lookupAccount('miora')).toBe('login')
    expect(lookupAccount('koto@terra-nova.city')).toBe('login')
    expect(lookupAccount('newbie@terra-nova.city')).toBe('register')
  })

  it('validateRegisterNames and secrets', () => {
    expect(validateRegisterNames('', 'Rakoto')).toBe('missing')
    expect(validateRegisterNames('Miora', 'Rakoto')).toBe('ok')
    expect(validateRegisterSecrets('short', 'short')).toBe('short')
    expect(validateRegisterSecrets('longenough', 'different')).toBe('mismatch')
    expect(validateRegisterSecrets('longenough', 'longenough')).toBe('ok')
  })

  it('sessionFromRegister builds a resident session', () => {
    const session = sessionFromRegister('newbie@terra-nova.city', 'Miora')
    expect(session.name).toBe('Miora')
    expect(session.role).toBe('resident')
    expect(session.roleLabel).toBe('Habitante')
    expect(session.accountId.length).toBeGreaterThan(0)
  })

  it('exposes French step titles', () => {
    expect(stepTitle('identify')).toBe('Demande d’approche')
    expect(stepTitle('register-3')).toBe('Empreinte de lumière')
    expect(stepSubtitle('register-1')).toBe('Deux détails, et Terra Nova vous reconnaît.')
    expect(stepSubtitle('register-3')).toBe('Enregistrez votre visage pour les prochaines entrées.')
    expect(stepSubtitle('login', { face: true })).toBe('Regardez la caméra pour entrer.')
  })
})
