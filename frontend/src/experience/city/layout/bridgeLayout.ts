import { CatmullRomCurve3, Vector3 } from 'three'
import { createPathSample, LAST_POSE, sampleCameraPath } from '../cameraPath'
import { BRIDGE, BRIDGE_PATH, ROAD_LIFT } from '../cityConfig'
import { relief } from './relief'
import { acrossOf, type SweepCurve } from './sweep'

/** A straight structural member between two points (a pier column or a cap beam). */
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
  /** twin pier columns, and the beam on top of each pair */
  columns: Member[]
  caps: Member[]
  /** footings at the water line, for columns standing in the lake */
  footings: Vector3[]
  lamps: Lamp[]
  /** across direction at mid-span (horizontal, right of the travel from the ring) */
  across: Vector3
}

const ROAD_EDGE = BRIDGE.roadHalf + BRIDGE.sidewalk
const PIER_SPACING = 18
const LAMP_SPACING = 16
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

/** Lays the viaduct out along BRIDGE_PATH: deck line, twin-column piers and lamps. */
export function layoutBridge(): BridgeLayout {
  const spline = new CatmullRomCurve3(BRIDGE_PATH.map(([x, y, z]) => new Vector3(x, y + ROAD_LIFT, z)))
  const road: SweepCurve = {
    getPoint: (t, out = new Vector3()) => spline.getPointAt(t, out),
    getTangent: (t, out = new Vector3()) => spline.getTangentAt(t, out),
    getLength: () => spline.getLength(),
  }
  const length = road.getLength()
  const mid = frameAt(road, length, length * 0.5)

  // twin columns every PIER_SPACING metres, from the lake bed or the ground to the girder
  const columns: Member[] = []
  const caps: Member[] = []
  const footings: Vector3[] = []
  for (let d = 9; d < length - 4; d += PIER_SPACING) {
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

  // lamp posts on the sidewalks, alternating sides, kept clear of the flyover camera
  const lamps: Lamp[] = []
  const camera = flyoverSamples()
  let side = 1
  for (let d = 6; d < length - 2; d += LAMP_SPACING / 2) {
    side = -side
    const { point, across } = frameAt(road, length, d)
    const foot = point.clone().addScaledVector(across, side * (ROAD_EDGE - 0.3)).setY(point.y + 0.18)
    const reach = across.clone().multiplyScalar(-side)
    const head = foot.clone().addScaledVector(reach, 0.85).setY(foot.y + 3.25)
    const post = { from: foot, to: foot.clone().setY(head.y) }
    if (camera.some((p) => distanceToMember(p, post) < CAMERA_CLEARANCE || p.distanceTo(head) < CAMERA_CLEARANCE)) continue
    lamps.push({ foot, reach, head })
  }

  return { road, length, columns, caps, footings, lamps, across: mid.across }
}

/** Shortest distance from point `p` to the segment of `member`. */
export function distanceToMember(p: Vector3, member: Member): number {
  const ab = member.to.clone().sub(member.from)
  const t = Math.min(1, Math.max(0, p.clone().sub(member.from).dot(ab) / ab.lengthSq()))
  return member.from.clone().addScaledVector(ab, t).distanceTo(p)
}
