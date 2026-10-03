import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { COUNCIL_TOWER, DOMES, POIS, poiById } from '../cityConfig'
import { generateCity } from '../layout/generateCity'
import { relief } from '../layout/relief'
import { boomClearance, createExploreCollision, setSiteObstacles } from './exploreCollision'

describe('createExploreCollision', () => {
  const collision = createExploreCollision(generateCity(true))
  const golf = poiById('golf')

  it('blocks water, the council tower and the central dome', () => {
    expect(collision.blocked(6, 58, null)).toBe(true)
    expect(collision.blocked(COUNCIL_TOWER.x, COUNCIL_TOWER.z, null)).toBe(true)
    expect(collision.blocked(DOMES[0].x, DOMES[0].z, null)).toBe(true)
  })

  it('lets a walker slide along a wall instead of sinking into it', () => {
    const hit = collision.resolve(COUNCIL_TOWER.x - 8, COUNCIL_TOWER.z, 8, 0, null)
    expect(hit.blocked).toBe(true)
    expect(Math.hypot(hit.x - COUNCIL_TOWER.x, hit.z - COUNCIL_TOWER.z)).toBeGreaterThan(2)
  })

  it('keeps Nova inside the site it landed on', () => {
    expect(collision.blocked(golf.x, golf.z, golf)).toBe(false)
    expect(collision.blocked(golf.x + golf.radius * 1.1, golf.z, golf)).toBe(true)
    // the city centre is out of reach from a site
    expect(collision.blocked(0, 0, golf)).toBe(true)
  })

  it('slides along the edge of a site instead of stopping dead', () => {
    const edge = golf.radius * 0.9
    const hit = collision.resolve(golf.x + edge, golf.z, 1, 0.4, golf)
    expect(Math.hypot(hit.x - golf.x, hit.z - golf.z)).toBeLessThan(golf.radius)
    expect(Math.abs(hit.z - golf.z)).toBeGreaterThan(0.05)
  })

  it('lands on dry ground at the centre of every site', () => {
    for (const poi of POIS) {
      const snap = collision.snap(poi.x, poi.z, poi)
      expect(snap.blocked).toBe(false)
      expect(snap.y).toBeGreaterThan(0.4)
    }
  })

  it("walks around a site's buildings and keeps the camera out of them", () => {
    const stade = poiById('stade')
    const y = Math.max(relief(stade.x + 5, stade.z), 0)
    setSiteObstacles('stade', [{ x: stade.x + 5, z: stade.z, halfX: 2, halfZ: 2, rotation: 0.3, top: y + 6 }])
    expect(collision.blocked(stade.x + 5, stade.z, stade)).toBe(true)
    expect(collision.blocked(stade.x + 5, stade.z, null)).toBe(false)
    const head = new Vector3(stade.x, y + 1.2, stade.z)
    expect(boomClearance(head, new Vector3(stade.x + 10, y + 2, stade.z), 'stade')).toBeLessThan(0.5)
    expect(boomClearance(head, new Vector3(stade.x - 6, y + 4, stade.z), 'stade')).toBe(1)
    setSiteObstacles('stade', [])
  })

  it('raises the skyline over the towers, not over open land', () => {
    expect(collision.skyline(COUNCIL_TOWER.x, COUNCIL_TOWER.z)).toBeGreaterThan(COUNCIL_TOWER.h)
    expect(collision.skyline(golf.x, golf.z)).toBeCloseTo(Math.max(relief(golf.x, golf.z), 0), 5)
  })
})
