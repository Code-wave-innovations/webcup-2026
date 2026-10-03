import { describe, expect, it } from 'vitest'
import { DOMES, RING, CITY_CENTER } from '../cityConfig'
import { generateCity, LOW_RISE_STRIDE, TREE_STRIDE } from './generateCity'

describe('generateCity', () => {
  const city = generateCity(true)

  it('fills the basin with low-rise blocks and terraces of trees', () => {
    expect(city.lowRise.length / LOW_RISE_STRIDE).toBeGreaterThan(350)
    expect(city.trees.length / TREE_STRIDE).toBeGreaterThan(150)
  })

  it('keeps the blocks off the domes and the ring road', () => {
    for (let i = 0; i < city.lowRise.length; i += LOW_RISE_STRIDE) {
      const x = city.lowRise[i]
      const z = city.lowRise[i + 2]
      for (const d of DOMES) expect(Math.hypot(x - d.x, z - d.z)).toBeGreaterThan(d.r)
      expect(Math.abs(Math.hypot(x - CITY_CENTER.x, z - CITY_CENTER.z) - RING.radius)).toBeGreaterThan(1.5)
    }
  })

  it('is deterministic', () => {
    expect(generateCity(true).lowRise).toEqual(city.lowRise)
  })
})
