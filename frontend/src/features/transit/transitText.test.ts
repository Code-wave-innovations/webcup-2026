import { describe, expect, it } from 'vitest'
import type { TransitDeparture, TransitLineDetail, TransitLineSummary } from '../../api/types'
import { favoriteStopsOf, groupDepartures, lineLabel, timetableByDirection, waitLabel } from './transitText'

const line = (id: number, code: string): TransitLineSummary => ({ id, code, name: `Ligne ${code}`, mode: 'BUS', color: null, status: 'NORMAL', status_message: null })

const departure = (lineId: number, minutes: number, direction: string | null = 'Terminus'): TransitDeparture => ({
  id: lineId * 1000 + minutes,
  line_id: lineId,
  stop_id: 1,
  day_type: 'WEEKDAY',
  time: `10:${String(minutes).padStart(2, '0')}`,
  direction,
  minutes_until: minutes,
  line: line(lineId, `L${lineId}`),
})

describe('waitLabel', () => {
  it('reads minutes then hours (fr)', () => {
    expect(waitLabel(0, 'fr')).toBe('à l’instant')
    expect(waitLabel(4, 'fr')).toBe('dans 4 min')
    expect(waitLabel(65, 'fr')).toBe('dans 1 h 05')
  })

  it('reads minutes then hours (en)', () => {
    expect(waitLabel(0, 'en')).toBe('now')
    expect(waitLabel(4, 'en')).toBe('in 4 min')
    expect(waitLabel(65, 'en')).toBe('in 1 h 05')
  })
})

describe('lineLabel', () => {
  it('names a line by code and name', () => {
    expect(lineLabel({ code: 'T1', name: 'Tram Centre ↔ Sud' })).toBe('T1 · Tram Centre ↔ Sud')
  })
})

describe('groupDepartures', () => {
  it('groups by line and direction, soonest first, three at most each', () => {
    const groups = groupDepartures([departure(2, 9), departure(1, 12), departure(2, 3), departure(2, 15), departure(2, 21), departure(2, 5, 'Autre sens')])
    expect(groups.map((g) => [g.line.code, g.direction, g.departures.map((d) => d.minutes_until)])).toEqual([
      ['L2', 'Terminus', [3, 9, 15]],
      ['L2', 'Autre sens', [5]],
      ['L1', 'Terminus', [12]],
    ])
  })
})

describe('favoriteStopsOf', () => {
  it('keeps valid ids only', () => {
    expect(favoriteStopsOf({ favorite_stops: [3, '4', -1, 7] })).toEqual([3, 7])
    expect(favoriteStopsOf({ theme: 'dark' })).toEqual([])
    expect(favoriteStopsOf(null)).toEqual([])
  })
})

describe('timetableByDirection', () => {
  const stop = (id: number, name: string, times_by_direction: Record<string, string[]>) =>
    ({ id, name, position: id - 1, district: null, times: Object.values(times_by_direction).flat(), times_by_direction }) as unknown as TransitLineDetail['stops'][number]

  it('splits by direction, orders stops along the run and drops the terminus', () => {
    const timetables = timetableByDirection([
      stop(1, 'A', { C: ['07:00', '07:20'], A: ['07:18'] }),
      stop(2, 'B', { C: ['07:04'], A: ['07:14'] }),
      stop(3, 'C', { C: ['07:08'], A: ['07:10'] }),
    ])
    expect(timetables.map((t) => [t.direction, t.rows.map((r) => r.stop.name)])).toEqual([
      ['C', ['A', 'B']],
      ['A', ['C', 'B']],
    ])
  })
})
