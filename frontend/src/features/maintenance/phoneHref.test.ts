import { describe, expect, it } from 'vitest'
import { phoneHref } from './phoneHref'

describe('phoneHref', () => {
  it('keeps the country prefix and drops spaces', () => {
    expect(phoneHref('+00 100 200')).toBe('tel:+00100200')
  })

  it('keeps a short emergency number', () => {
    expect(phoneHref('15')).toBe('tel:15')
  })
})
