import { describe, expect, it } from 'vitest'
import { previewService, summarizeTimes } from './timetable'

describe('previewService', () => {
  it('generates both directions with the same times', () => {
    const [out, back] = previewService(['A', 'B', 'C'], { first: '06:00', last: '22:00', everyMinutes: 15, minutesBetweenStops: 3, returnTrip: true })
    expect(out.towards).toBe('C')
    expect(back.towards).toBe('A')
    expect(out.times).toHaveLength(65)
    expect(out.times.slice(0, 3)).toEqual(['06:00', '06:15', '06:30'])
    expect(out.times.at(-1)).toBe('22:00')
    expect(out.departures).toBe(65 * 3)
  })

  it('drops the stops reached after midnight', () => {
    const [out] = previewService(['A', 'B', 'C'], { first: '23:50', last: '23:58', everyMinutes: 10, minutesBetweenStops: 6, returnTrip: false })
    expect(out.times).toEqual(['23:50'])
    expect(out.departures).toBe(2)
  })

  it('returns nothing for invalid inputs', () => {
    expect(previewService([], { first: '06:00', last: '07:00', everyMinutes: 10, minutesBetweenStops: 3, returnTrip: true })).toEqual([])
    expect(previewService(['A'], { first: '6h', last: '07:00', everyMinutes: 10, minutesBetweenStops: 3, returnTrip: true })).toEqual([])
    expect(previewService(['A'], { first: '06:00', last: '07:00', everyMinutes: 0, minutesBetweenStops: 3, returnTrip: true })).toEqual([])
  })
})

describe('summarizeTimes', () => {
  it('shortens long lists', () => {
    expect(summarizeTimes(['06:00', '06:15'])).toBe('06:00, 06:15')
    expect(summarizeTimes(['1', '2', '3', '4', '5', '6', '7'])).toBe('1, 2, 3, 4 … 6, 7')
  })
})
