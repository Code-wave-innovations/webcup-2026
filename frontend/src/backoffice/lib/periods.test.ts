import { describe, expect, it } from 'vitest'
import { periodFrom } from './periods'

describe('periodFrom', () => {
  const at = (iso: string) => new Date(iso).getTime()

  it('keeps the same start, hence the same query key, within a 5-minute step (F95)', () => {
    const first = periodFrom('heure', at('2026-10-04T10:00:30Z'))
    expect(periodFrom('heure', at('2026-10-04T10:04:59Z'))).toBe(first)
    expect(first).toBe('2026-10-04T09:00:00.000Z')
  })

  it('moves to the next step after 5 minutes', () => {
    expect(periodFrom('jour', at('2026-10-04T10:05:00Z'))).toBe('2026-10-03T10:05:00.000Z')
  })

  it('has no start for the whole journal', () => {
    expect(periodFrom('tout', at('2026-10-04T10:00:00Z'))).toBeUndefined()
  })
})
