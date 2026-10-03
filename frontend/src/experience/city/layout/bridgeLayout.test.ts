import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createPathSample, LAST_POSE, sampleCameraPath } from '../cameraPath'
import { BRIDGE } from '../cityConfig'
import { distanceToMember, layoutBridge } from './bridgeLayout'

const bridge = layoutBridge()

describe('layoutBridge', () => {
  it('keeps the pylon, its mast and every stay clear of the flyover camera', () => {
    const sample = createPathSample()
    const camera = new Vector3()
    const members = [
      ...bridge.legs,
      bridge.mast,
      bridge.strut,
      ...bridge.stays,
      ...bridge.lamps.map((lamp) => ({ from: lamp.foot, to: lamp.head })),
    ]
    let closest = Infinity
    for (let u = 0; u <= LAST_POSE; u += 0.005) {
      sampleCameraPath(u, sample)
      camera.fromArray(sample.position)
      for (const member of members) closest = Math.min(closest, distanceToMember(camera, member))
    }
    expect(closest).toBeGreaterThan(2.5)
  })

  it('anchors the stays on both sides of the deck, fanning out both ways from the pylon', () => {
    expect(bridge.stays).toHaveLength((BRIDGE.staysBack + BRIDGE.staysOut) * 2)
    for (const stay of bridge.stays) {
      expect(stay.to.y).toBeGreaterThan(stay.from.y + BRIDGE.pylonHeight - 1)
    }
  })

  it('stands the legs outside the deck where they cross it', () => {
    const deckY = bridge.mast.from.y - BRIDGE.pylonHeight
    for (const leg of bridge.legs) {
      const k = (deckY - leg.from.y) / (leg.to.y - leg.from.y)
      const atDeck = leg.from.clone().lerp(leg.to, k)
      const centre = bridge.mast.from.clone().setY(deckY)
      expect(atDeck.distanceTo(centre)).toBeGreaterThan(BRIDGE.roadHalf + BRIDGE.sidewalk + 0.15)
    }
  })
})
