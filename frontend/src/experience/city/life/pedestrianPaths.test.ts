import { describe, expect, it } from 'vitest'
import { CITY_CENTER } from '../cityConfig'
import { relief } from '../layout/relief'
import { createWalkers, updateWalkers } from './pedestrianPaths'

const FRAME = 1 / 60

describe('createWalkers', () => {
  it('walks the same way on every visit', () => {
    const a = createWalkers(false)
    const b = createWalkers(false)
    for (let i = 0; i < 90; i++) {
      updateWalkers(a, FRAME)
      updateWalkers(b, FRAME)
    }
    expect(a.map((w) => w.position.toArray())).toEqual(b.map((w) => w.position.toArray()))
  })

  it('keeps walkers on dry ground near the city', () => {
    const walkers = createWalkers(false)
    expect(walkers.length).toBeGreaterThan(20)
    for (let i = 0; i < 120; i++) updateWalkers(walkers, FRAME)
    for (const walker of walkers) {
      expect(walker.position.y).toBeGreaterThan(0.4)
      expect(walker.position.y).toBeCloseTo(Math.max(relief(walker.position.x, walker.position.z), 0.2), 3)
      expect(Math.hypot(walker.position.x - CITY_CENTER.x, walker.position.z - CITY_CENTER.z)).toBeLessThan(50)
    }
  })
})
