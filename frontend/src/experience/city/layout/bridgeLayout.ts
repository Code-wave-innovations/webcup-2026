import { CatmullRomCurve3, Vector3 } from 'three'
import { createPathSample, LAST_POSE, sampleCameraPath } from '../cameraPath'
import { BRIDGE, BRIDGE_PATH, ROAD_LIFT } from '../cityConfig'
import { relief } from './relief'
import { acrossOf, type SweepCurve } from './sweep'

/** A straight structural member between two points (a pylon leg, a stay, a pier column). */
export interface Member {
  from: Vector3
  to: Vector3
}

/** Where a lamp post stands on the deck, and which way its arm reaches (towards the road). */
export interface Lamp {
  foot: Vector3
  /** horizontal unit vector from the post to the road */
  reach: Vector3
  head: Vector3
}

export interface BridgeLayout {
  /** the road surface's centre line, parametrised by arc length (uniform t) */
  road: SweepCurve
  length: number
  legs: Member[]
  /** cross beam between the legs, under the deck */
  strut: Member
  mast: Member
  stays: Member[]
  /** twin pier columns, and the beam on top of each pair */
  columns: Member[]
  caps: Member[]
  /** footings at the water line, for columns standing in the lake */
  footings: Vector3[]
  lamps: Lamp[]
  /** across direction at the pylon (horizontal, right of the travel from the ring) */
  across: Vector3
}

const ROAD_EDGE = BRIDGE.roadHalf + BRIDGE.sidewalk
const PIER_SPACING = 18
const LAMP_SPACING = 16
const LAKE_BED = -2.6
/** lamp posts this close to the flyover camera are left out (it skims the deck before the first district) */
const CAMERA_CLEARANCE = 3

function flyoverSamples(): Vector3[] {
  const sample = createPathSample()
  const points: Vector3[] = []
  for (let u = 0; u <= LAST_POSE; u += 0.01) points.push(new Vector3().fromArray(sampleCameraPath(u, sample).position))
  return points
}

/** Point and frame of the road at `d` metres from the ring. */
function frameAt(road: SweepCurve, length: number, d: number) {
  const t = Math.min(1, Math.max(0, d / length))
  const point = road.getPoint(t)
  const tangent = road.getTangent(t).normalize()
  const across = acrossOf(tangent, new Vector3())
  return { point, tangent, across }
}

/** Lays the cable-stayed bridge out along BRIDGE_PATH: deck line, A-pylon, stays, piers and lamps. */
export function layoutBridge(): BridgeLayout {
  const spline = new CatmullRomCurve3(BRIDGE_PATH.map(([x, y, z]) => new Vector3(x, y + ROAD_LIFT, z)))
  const road: SweepCurve = {
    getPoint: (t, out = new Vector3()) => spline.getPointAt(t, out),
    getTangent: (t, out = new Vector3()) => spline.getTangentAt(t, out),
    getLength: () => spline.getLength(),
  }
  const length = road.getLength()

  // the pylon: two legs from the lake bed either side of the deck, meeting at the apex above its middle
  const pylon = frameAt(road, length, BRIDGE.pylonAt)
  const apex = pylon.point.clone().setY(pylon.point.y + BRIDGE.pylonHeight)
  const legs = [-1, 1].map((side) => ({
    from: pylon.point.clone().addScaledVector(pylon.across, side * BRIDGE.legSpread).setY(LAKE_BED),
    to: apex.clone(),
  }))
  const strutY = pylon.point.y - BRIDGE.depth - 0.45
  const legAt = (y: number) => BRIDGE.legSpread * (1 - (y - LAKE_BED) / (apex.y - LAKE_BED))
  const strut = {
    from: pylon.point.clone().addScaledVector(pylon.across, -legAt(strutY)).setY(strutY),
    to: pylon.point.clone().addScaledVector(pylon.across, legAt(strutY)).setY(strutY),
  }
  const mast = { from: apex.clone(), to: apex.clone().setY(apex.y + BRIDGE.mast) }

  // two fans of stays per side (back to the ring and out over the lake), the longest anchored highest on the mast
  const stays: Member[] = []
  for (const along of [-1, 1]) {
    const count = along < 0 ? BRIDGE.staysBack : BRIDGE.staysOut
    for (let k = 0; k < count; k++) {
      const d = BRIDGE.pylonAt + along * (5 + k * BRIDGE.staySpacing)
      const anchor = frameAt(road, length, d)
      const height = 1.2 + (k * (BRIDGE.mast - 1.8)) / (BRIDGE.staysOut - 1)
      for (const side of [-1, 1]) {
        stays.push({
          from: anchor.point.clone().addScaledVector(anchor.across, side * (ROAD_EDGE - 0.12)).setY(anchor.point.y + 0.25),
          to: apex
            .clone()
            .addScaledVector(pylon.across, side * 0.42)
            .addScaledVector(pylon.tangent, along * 0.45)
            .setY(apex.y + height),
        })
      }
    }
  }

  // twin columns every PIER_SPACING metres (not under the pylon), from the lake bed or the ground to the girder
  const columns: Member[] = []
  const caps: Member[] = []
  const footings: Vector3[] = []
  for (let d = 9; d < length - 4; d += PIER_SPACING) {
    if (Math.abs(d - BRIDGE.pylonAt) < 10) continue
    const { point, across } = frameAt(road, length, d)
    const top = point.y - BRIDGE.depth - 0.35
    for (const side of [-1, 1]) {
      const foot = point.clone().addScaledVector(across, side * 1.9)
      const ground = relief(foot.x, foot.z)
      if (ground > top - 0.6) continue
      columns.push({ from: foot.clone().setY(Math.min(ground, 0) - 0.4), to: foot.clone().setY(top) })
      if (ground < 0.15) footings.push(foot.clone().setY(0))
    }
    caps.push({ from: point.clone().addScaledVector(across, -2.5).setY(top + 0.25), to: point.clone().addScaledVector(across, 2.5).setY(top + 0.25) })
  }

  // lamp posts on the sidewalks, alternating sides, clear of the pylon
  const lamps: Lamp[] = []
  const camera = flyoverSamples()
  let side = 1
  for (let d = 6; d < length - 2; d += LAMP_SPACING / 2) {
    side = -side
    if (Math.abs(d - BRIDGE.pylonAt) < 6) continue
    const { point, across } = frameAt(road, length, d)
    const foot = point.clone().addScaledVector(across, side * (ROAD_EDGE - 0.3)).setY(point.y + 0.18)
    const reach = across.clone().multiplyScalar(-side)
    const head = foot.clone().addScaledVector(reach, 0.85).setY(foot.y + 3.25)
    const post = { from: foot, to: foot.clone().setY(head.y) }
    if (camera.some((p) => distanceToMember(p, post) < CAMERA_CLEARANCE || p.distanceTo(head) < CAMERA_CLEARANCE)) continue
    lamps.push({ foot, reach, head })
  }

  return { road, length, legs, strut, mast, stays, columns, caps, footings, lamps, across: pylon.across }
}

/** Shortest distance from point `p` to the segment of `member`. */
export function distanceToMember(p: Vector3, member: Member): number {
  const ab = member.to.clone().sub(member.from)
  const t = Math.min(1, Math.max(0, p.clone().sub(member.from).dot(ab) / ab.lengthSq()))
  return member.from.clone().addScaledVector(ab, t).distanceTo(p)
}
