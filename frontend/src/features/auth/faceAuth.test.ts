import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { accountForIdentity, faceFailure, identityMatchesIdentifier } from './faceAuth'

const httpError = (status: number) => new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status } as AxiosResponse)

describe('faceAuth', () => {
  it('maps a gallery identity to the demo account enrolled under it', () => {
    expect(accountForIdentity('miora')?.name).toBe('Miora')
    expect(accountForIdentity('miora.at.terra-nova.city')?.name).toBe('Miora')
    expect(accountForIdentity('conseil')?.role).toBe('council')
    expect(accountForIdentity('someone-else')).toBeUndefined()
    expect(accountForIdentity(null)).toBeUndefined()
  })

  it('tells an unknown face from no face and from a missing service', () => {
    expect(faceFailure(httpError(404))).toBe('unknown')
    expect(faceFailure(httpError(400))).toBe('noFace')
    expect(faceFailure(httpError(503))).toBe('unavailable')
    expect(faceFailure(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('unavailable')
    expect(faceFailure(new Error('boom'))).toBe('unavailable')
  })

  it('compares gallery identity to the typed identifier', () => {
    expect(identityMatchesIdentifier('miora.at.terra-nova.city', 'miora@terra-nova.city')).toBe(true)
    expect(identityMatchesIdentifier('miora.at.terra-nova.city', 'miora')).toBe(true)
    expect(identityMatchesIdentifier('miora', 'miora@terra-nova.city')).toBe(true)
    expect(identityMatchesIdentifier('koto.at.terra-nova.city', 'miora@terra-nova.city')).toBe(false)
    expect(identityMatchesIdentifier('newbie.at.terra-nova.city', 'other@terra-nova.city')).toBe(false)
  })
})
