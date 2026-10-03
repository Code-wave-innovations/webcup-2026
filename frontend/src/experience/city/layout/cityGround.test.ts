import { describe, expect, it } from 'vitest'
import { SUN_AZIMUTH } from '../cityConfig'
import { bakeGroundShadows, GROUND_MAP, type Footprint } from './cityGround'

const at = (bytes: Uint8Array, x: number, z: number, channel: 0 | 1) => {
  const { size, half, centerX, centerZ } = GROUND_MAP
  const i = Math.floor(((x - centerX + half) / (2 * half)) * size)
  const j = Math.floor(((z - centerZ + half) / (2 * half)) * size)
  return bytes[(j * size + i) * 4 + channel]
}

describe('ground shadows', () => {
  const tower: Footprint = { x: 0, z: -4, halfX: 2, halfZ: 2, rotation: 0, height: 10, box: false }
  const bytes = bakeGroundShadows([tower])

  it('darkens the ground around the foot of a building', () => {
    expect(at(bytes, 0, -4, 0)).toBeGreaterThan(180)
    expect(at(bytes, 0, -4 + 2.6, 0)).toBeGreaterThan(40)
    expect(at(bytes, 30, 30, 0)).toBe(0)
  })

  it('casts a long shadow away from the setting sun, none towards it', () => {
    const away = (d: number) => at(bytes, -SUN_AZIMUTH.x * d, -4 - SUN_AZIMUTH.z * d, 1)
    const towards = (d: number) => at(bytes, SUN_AZIMUTH.x * d, -4 + SUN_AZIMUTH.z * d, 1)
    expect(away(12)).toBeGreaterThan(100)
    expect(away(30)).toBe(0)
    expect(towards(8)).toBe(0)
  })
})
