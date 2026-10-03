import { describe, expect, it } from 'vitest'
import { createEntryTimeline } from './entryTimeline'

describe('entry timeline', () => {
  it('starts in orbit, whites out at the cut, then clears over the city', () => {
    const entry = createEntryTimeline(false)
    entry.seek(0)
    expect(entry.cues).toMatchObject({ rush: 0, shake: 0, plasma: 0, veil: 0, arrival: 0 })
    entry.seek(4.3)
    expect(entry.cues.plasma).toBeCloseTo(1)
    expect(entry.cues.shake).toBeCloseTo(1)
    entry.seek(entry.marks.cut - 0.001)
    expect(entry.cues.veil).toBeGreaterThan(0.99)
    entry.seek(entry.marks.cut + 0.001)
    expect(entry.cues.plasma).toBe(0)
    expect(entry.cues.arrival).toBeLessThan(0.01)
    entry.seek(entry.marks.arrive)
    expect(entry.cues.veil).toBe(0)
    expect(entry.cues.clouds).toBe(1)
    entry.seek(entry.marks.end)
    expect(entry.cues.arrival).toBe(1)
  })

  it('can be sought backwards and forwards (skip, ?entree)', () => {
    const entry = createEntryTimeline(false)
    entry.seek(9)
    const late = entry.cues.arrival
    entry.seek(2)
    expect(entry.cues.arrival).toBe(0)
    expect(entry.cues.veil).toBe(0)
    entry.seek(9)
    expect(entry.cues.arrival).toBe(late)
  })

  it('is a short fade without shake, plasma nor flight when motion is reduced', () => {
    const entry = createEntryTimeline(true)
    for (let t = 0; t <= entry.marks.end; t += 0.05) {
      entry.seek(t)
      expect(entry.cues.shake + entry.cues.plasma + entry.cues.speedBlur + entry.cues.rush).toBe(0)
    }
    entry.seek(entry.marks.cut + 0.01)
    expect(entry.cues.arrival).toBe(1)
    expect(entry.marks.end).toBeLessThan(1.5)
  })
})
