import { clamp, lerp } from '../../lib/math'

type Vec3 = readonly [number, number, number]

/** One stop of the flyover: one per section of the city page. */
interface CameraPose {
  position: Vec3
  target: Vec3
  /** time of day: 0 late afternoon → 1 night */
  hour: number
  /** vertical field of view, in degrees */
  focal: number
  /** which side the subject sits on, opposite the text column: -1 left … 1 right */
  side: number
  /** control point of the curve towards the next pose (defaults to the midpoint) */
  via?: Vec3
}

export const CAMERA_POSES: readonly CameraPose[] = [
  { position: [-6, 12.5, 150], target: [6, 19, 0], hour: 0.0, focal: 40, side: 0.55, via: [-10, 9, 96] },
  { position: [-3, 6.5, 47], target: [9, 6.5, 8], hour: 0.16, focal: 42, side: -1, via: [30, 12, 60] },
  { position: [52, 8.5, 8], target: [26, 4.5, -6], hour: 0.34, focal: 40, side: 1, via: [10, 26, 78] },
  { position: [-46, 7.5, 36], target: [-24, 5, 9], hour: 0.55, focal: 40, side: -1, via: [-40, 20, 52] },
  { position: [20, 27, 36], target: [-4, 37, -10], hour: 0.78, focal: 44, side: 1, via: [24, 44, 110] },
  { position: [-8, 22, 172], target: [4, 33, 0], hour: 1.0, focal: 40, side: -0.7 },
]

export const LAST_POSE = CAMERA_POSES.length - 1

export interface CameraPathSample {
  position: [number, number, number]
  target: [number, number, number]
  hour: number
  focal: number
  side: number
}

export function createPathSample(): CameraPathSample {
  return { position: [0, 0, 0], target: [0, 0, 0], hour: 0, focal: 40, side: 0 }
}

/**
 * Camera at scroll progress `u` (0 = first pose, LAST_POSE = last): the position follows a quadratic
 * Bézier through each segment's control point, everything else eases with a smoothstep. Writes into `out`.
 */
export function sampleCameraPath(u: number, out: CameraPathSample): CameraPathSample {
  const index = Math.min(LAST_POSE - 1, Math.max(0, Math.floor(u)))
  const f = clamp(u - index, 0, 1)
  const e = f * f * (3 - 2 * f)
  const from = CAMERA_POSES[index]
  const to = CAMERA_POSES[index + 1]
  const a = (1 - e) * (1 - e)
  const b = 2 * (1 - e) * e
  const c = e * e
  for (let k = 0; k < 3; k++) {
    const via = from.via ? from.via[k] : (from.position[k] + to.position[k]) / 2
    out.position[k] = a * from.position[k] + b * via + c * to.position[k]
    out.target[k] = lerp(from.target[k], to.target[k], e)
  }
  out.hour = lerp(from.hour, to.hour, e)
  out.focal = lerp(from.focal, to.focal, e)
  out.side = lerp(from.side, to.side, e)
  return out
}
