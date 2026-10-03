import { describe, expect, it } from 'vitest'
import { CITY_CENTER, RING } from '../cityConfig'
import { createTraffic, updateTraffic } from './vehiclePaths'

const FRAME = 1 / 60

describe('createTraffic', () => {
  it('drives the same way on every visit', () => {
    const a = createTraffic(false)
    const b = createTraffic(false)
    for (let i = 0; i < 120; i++) {
      updateTraffic(a, FRAME)
      updateTraffic(b, FRAME)
    }
    expect(a.map((v) => v.position.toArray())).toEqual(b.map((v) => v.position.toArray()))
  })

  it('sends fewer cars on light devices', () => {
    expect(createTraffic(true).length).toBeLessThan(createTraffic(false).length)
  })

  it('keeps every car on the ring or the bridge', () => {
    const traffic = createTraffic(false)
    for (let i = 0; i < 180; i++) updateTraffic(traffic, FRAME)
    for (const car of traffic) {
      expect(Number.isFinite(car.position.x + car.position.y + car.position.z)).toBe(true)
      const ring = Math.hypot(car.position.x - CITY_CENTER.x, car.position.z - CITY_CENTER.z)
      const onRing = Math.abs(ring - RING.radius) < 2 && Math.abs(car.position.y - (RING.height + RING.deckThick / 2)) < 0.2
      const onBridge = car.position.z > 28 && car.position.y > 2
      expect(onRing || onBridge).toBe(true)
    }
  })
})
