import { describe, expect, it } from 'vitest'
import { formatLocalTime, formatRelative } from './format'

describe('formatLocalTime', () => {
  it('formats the device wall clock as HH:MM', () => {
    const moment = new Date(2026, 9, 4, 9, 5, 30).getTime()
    expect(formatLocalTime(moment)).toBe('09:05')
  })
})

describe('formatRelative', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z')

  it('formats recent and older past times in French', () => {
    expect(formatRelative('2026-10-04T11:59:30.000Z', now)).toBe('à l’instant')
    expect(formatRelative('2026-10-04T11:48:00.000Z', now)).toBe('il y a 12 min')
    expect(formatRelative('2026-10-04T09:00:00.000Z', now)).toBe('il y a 3 h')
    expect(formatRelative('2026-10-02T12:00:00.000Z', now)).toBe('il y a 2 j')
  })
})

describe('formatRelative in English', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z')

  it('formats past and future times', () => {
    expect(formatRelative('2026-10-04T11:59:30.000Z', now, 'en')).toBe('just now')
    expect(formatRelative('2026-10-04T11:48:00.000Z', now, 'en')).toBe('12 min ago')
    expect(formatRelative('2026-10-06T12:00:00.000Z', now, 'en')).toBe('in 2 d')
  })
})
