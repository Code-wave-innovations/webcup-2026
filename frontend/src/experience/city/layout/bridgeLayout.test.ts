import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createPathSample, LAST_POSE, sampleCameraPath } from '../cameraPath'
import { BRIDGE } from '../cityConfig'
import { distanceToMember, layoutBridge } from './bridgeLayout'

const bridge = layoutBridge()

describe('layoutBridge', () => {
  it('keeps every lamp clear of the flyover camera', () => {
    const sample = createPathSample()
    const camera = new Vector3()
    const members = bridge.lamps.map((lamp) => ({ from: lamp.foot, to: lamp.head }))
    let closest = Infinity
    for (let u = 0; u <= LAST_POSE; u += 0.005) {
      sampleCameraPath(u, sample)
      camera.fromArray(sample.position)
      for (const member of members) closest = Math.min(closest, distanceToMember(camera, member))
    }
    expect(closest).toBeGreaterThan(2.5)
  })

  it('plants twin-column piers along the deck', () => {
    expect(bridge.columns.length).toBeGreaterThan(4)
    expect(bridge.caps.length).toBeGreaterThan(2)
    for (const column of bridge.columns) {
      expect(column.to.y).toBeGreaterThan(column.from.y)
      expect(column.to.y).toBeLessThan(8)
    }
  })

  it('stands the pier columns beside the roadway', () => {
    const road = bridge.road
    for (const column of bridge.columns) {
      const foot = column.from
      let nearest = Infinity
      for (let t = 0; t <= 1; t += 0.02) {
        const point = road.getPoint(t)
        nearest = Math.min(nearest, Math.hypot(point.x - foot.x, point.z - foot.z))
      }
      expect(nearest).toBeGreaterThan(1.2)
      expect(nearest).toBeLessThan(BRIDGE.roadHalf + BRIDGE.sidewalk)
    }
  })
})
