import { describe, expect, it } from 'vitest'
import { CAMERA_POSES, createPathSample, LAST_POSE, sampleCameraPath } from './cameraPath'
import { BRIDGE_PATH, CITY_CENTER, POIS, RING } from './cityConfig'
import { naturalRelief, relief, sitePlateaus } from './layout/relief'

/** The flyover's camera, sampled densely along the scroll path. */
const flyover = (() => {
  const sample = createPathSample()
  const points: Array<readonly [number, number]> = CAMERA_POSES.map((pose) => [pose.position[0], pose.position[2]] as const)
  for (let u = 0; u <= LAST_POSE; u += 0.02) {
    sampleCameraPath(u, sample)
    points.push([sample.position[0], sample.position[2]])
  }
  return points
})()

describe('sites the visitor can fly to', () => {
  it('stay clear of the flyover camera, the city, the bridge and each other', () => {
    for (const poi of POIS) {
      for (const [x, z] of flyover) expect(Math.hypot(x - poi.x, z - poi.z) - poi.radius).toBeGreaterThan(15)
      expect(Math.hypot(poi.x - CITY_CENTER.x, poi.z - CITY_CENTER.z) - poi.radius).toBeGreaterThan(RING.radius + 6)
      for (const [x, , z] of BRIDGE_PATH) expect(Math.hypot(x - poi.x, z - poi.z) - poi.radius).toBeGreaterThan(10)
      for (const other of POIS) {
        if (other !== poi) expect(Math.hypot(other.x - poi.x, other.z - poi.z)).toBeGreaterThan(other.radius + poi.radius)
      }
    }
  })

  it('stand above the water everywhere on their ground', () => {
    for (const poi of POIS) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2
        for (const r of [0, poi.radius * 0.5, poi.radius]) expect(relief(poi.x + Math.cos(a) * r, poi.z + Math.sin(a) * r)).toBeGreaterThan(0.5)
      }
    }
  })

  it('level their ground towards the plateau without digging a crater', () => {
    POIS.forEach((poi, i) => {
      const plateau = sitePlateaus()[i]
      // the centre moves towards the plateau by the site's flatten share, and the far edge keeps the natural ground
      const natural = naturalRelief(poi.x, poi.z)
      expect(Math.abs(relief(poi.x, poi.z) - plateau)).toBeLessThanOrEqual(Math.abs(natural - plateau) + 1e-6)
      const edge = poi.radius * 1.85
      for (let k = 0; k < 12; k++) {
        const x = poi.x + Math.cos((k / 12) * Math.PI * 2) * edge
        const z = poi.z + Math.sin((k / 12) * Math.PI * 2) * edge
        if (POIS.some((other) => other !== poi && Math.hypot(x - other.x, z - other.z) < other.radius * 1.8)) continue
        expect(relief(x, z)).toBeCloseTo(naturalRelief(x, z), 5)
      }
    })
  })
})
