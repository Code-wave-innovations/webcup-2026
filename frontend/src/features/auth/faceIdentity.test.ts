import { describe, expect, it } from 'vitest'
import { emailFromFaceIdentity, faceIdentityFromEmail } from './faceIdentity'

describe('faceIdentityFromEmail', () => {
  it('encodes @ for the face gallery', () => {
    expect(faceIdentityFromEmail('  Miora@Terra-Nova.City ')).toBe('miora.at.terra-nova.city')
  })

  it('stays within the 64-char gallery limit', () => {
    const long = `${'a'.repeat(40)}@${'b'.repeat(40)}.city`
    expect(faceIdentityFromEmail(long).length).toBeLessThanOrEqual(64)
    expect(faceIdentityFromEmail(long).includes('@')).toBe(false)
  })

  it('round-trips e-mail identities', () => {
    expect(emailFromFaceIdentity('miora.at.terra-nova.city')).toBe('miora@terra-nova.city')
    expect(emailFromFaceIdentity('miora')).toBeNull()
  })
})
