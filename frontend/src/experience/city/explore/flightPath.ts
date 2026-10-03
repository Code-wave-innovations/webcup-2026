import { CatmullRomCurve3, Quaternion, Vector3 } from 'three'
import { clamp, lerp, smoothstep } from '../../../lib/math'
import { relief } from '../layout/relief'

/**
 * Nova's Iron Man flight, as pure functions of time. `crouch`: anticipation on the spot. `takeoff`: a vertical
 * burst that pitches forward as it gathers speed. `cruise`: over the skyline at top speed. `flare`: the dive onto
 * the site, braking hard, the body swinging upright feet first. `landing`: the superhero landing, then standing up.
 */
export type FlightPhase = 'crouch' | 'takeoff' | 'cruise' | 'flare' | 'landing'

export const CROUCH_SECONDS = 0.4
export const LANDING_SECONDS = 1.3
/** top speed (world units are metres: Nova is 1.7 tall), ~200 km/h */
const CRUISE_SPEED = 55
/** the way back to the sky, straight up and out of the frame */
const EXIT_SPEED = 62
const ACCEL_SECONDS = 1.7
const BRAKE_SECONDS = 2.1
const TOUCHDOWN_SPEED = 3
/** clearance over the skyline while cruising, and the least climb over the higher end of the trip */
const CRUISE_CLEARANCE = 14
const MIN_CLIMB = 20
/** the vertical burst before the path leans towards the destination */
const RISE = 7
/** lateral acceleration that banks Nova 45° in a turn */
const BANK_G = 26
const MAX_BANK = 0.85
/** pitch of the body: 0 upright, π/2 lying along a level flight (head first); a dive stops a bit past level */
const MAX_PITCH = 1.62
/** Nova on a site, in world units (a person next to the 6-unit houses) */
export const NOVA_WORLD_SCALE = 1.7
/** Nova pivots around its waist (share of its height) when it tilts into the flight */
export const FLIGHT_PIVOT = 0.52

export interface FlightPlan {
  readonly curve: CatmullRomCurve3
  readonly length: number
  /** top speed actually reached (a short hop does not reach the cruise speed) */
  readonly speed: number
  readonly accel: number
  readonly cruise: number
  readonly brake: number
  readonly touchdown: number
  /** ends on the ground (a site), or keeps climbing out of the frame (back to the flyover) */
  readonly lands: boolean
  /** heading when the flight starts (facing the camera on the walkway…), and the one it leaves on */
  readonly startYaw: number
  readonly departYaw: number
  /** seconds from the start to the touchdown (or to the end of the climb) */
  readonly arrival: number
  /** whole flight, landing included */
  readonly duration: number
}

export interface FlightSample {
  phase: FlightPhase
  /** feet when upright; Nova pivots around its waist above this point when it tilts */
  position: Vector3
  velocity: Vector3
  /** share of the cruise speed, 0 → 1 */
  speed: number
  yaw: number
  pitch: number
  roll: number
  /** how hard the repulsors push, 0 → 1 */
  thrust: number
}

export const createFlightSample = (): FlightSample => ({
  phase: 'crouch',
  position: new Vector3(),
  velocity: new Vector3(),
  speed: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  thrust: 0,
})

/** Height the flight must clear at (x, z): the terrain by default, the buildings when the city provides them. */
export type Skyline = (x: number, z: number) => number

const groundSkyline: Skyline = (x, z) => Math.max(relief(x, z), 0)

const wrapAngle = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))
const lerpAngle = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t

function finishPlan(points: Vector3[], lands: boolean, cruiseSpeed: number, startYaw: number, departYaw: number): FlightPlan {
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  curve.arcLengthDivisions = 600
  const length = curve.getLength()
  const accel = ACCEL_SECONDS
  const brake = lands ? BRAKE_SECONDS : 0
  const touchdown = lands ? TOUCHDOWN_SPEED : 0
  let speed = cruiseSpeed
  // length = speed·accel/2 + speed·cruise + brake·(touchdown + (speed − touchdown)/2)
  let cruise = (length - (speed * accel) / 2 - (brake * (touchdown + speed)) / 2) / speed
  if (cruise < 0) {
    speed = (length - (brake * touchdown) / 2) / ((accel + brake) / 2)
    cruise = 0
  }
  const arrival = CROUCH_SECONDS + accel + cruise + brake
  return { curve, length, speed, accel, cruise, brake, touchdown, lands, startYaw, departYaw, arrival, duration: arrival + (lands ? LANDING_SECONDS : 0) }
}

/** Flight from `from` (feet) to the landing spot `to`, high enough over `skyline` along the way. */
export function planFlight(from: Vector3, to: Vector3, startYaw: number, skyline: Skyline = groundSkyline): FlightPlan {
  const dir = new Vector3(to.x - from.x, 0, to.z - from.z)
  const dist = dir.length()
  if (dist > 1e-3) dir.divideScalar(dist)
  else dir.set(Math.sin(startYaw), 0, Math.cos(startYaw))
  const across = new Vector3(-dir.z, 0, dir.x)

  // cruise altitude: over the highest point of a corridor along the route
  let top = Math.max(from.y, to.y) + MIN_CLIMB - CRUISE_CLEARANCE
  for (let k = 0; k <= 40; k++) {
    const x = lerp(from.x, to.x, k / 40)
    const z = lerp(from.z, to.z, k / 40)
    for (const side of [-10, 0, 10]) top = Math.max(top, skyline(x + across.x * side, z + across.z * side))
  }
  const cruiseY = top + CRUISE_CLEARANCE

  const up = (p: Vector3, y: number) => p.clone().setY(y)
  const points = [from.clone(), up(from, from.y + RISE)]
  const lead = Math.min(dist * 0.28, 45)
  const tail = Math.min(dist * 0.3, 50)
  if (lead + tail < dist * 0.9) {
    points.push(up(from.clone().addScaledVector(dir, lead), cruiseY), up(to.clone().addScaledVector(dir, -tail), cruiseY))
  } else {
    points.push(up(from.clone().lerp(to, 0.4), cruiseY))
  }
  points.push(up(to.clone().addScaledVector(dir, -Math.min(16, dist * 0.3)), to.y + 10), up(to, to.y + 2.2), to.clone())
  return finishPlan(points, true, CRUISE_SPEED, startYaw, Math.atan2(dir.x, dir.z))
}

/** The way back to the flyover: a vertical burst that keeps climbing out of the frame, leaning on `yaw`. */
export function planExit(from: Vector3, yaw: number): FlightPlan {
  const dir = new Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  const at = (forward: number, rise: number) => from.clone().addScaledVector(dir, forward).setY(from.y + rise)
  return finishPlan([from.clone(), at(0.5, 14), at(8, 60), at(30, 170)], false, EXIT_SPEED, yaw, yaw)
}

/** Distance flown and speed `tau` seconds after the burst (smooth acceleration and braking). */
function travel(plan: FlightPlan, tau: number): { s: number; v: number; brake: number } {
  const { speed: V, accel: ta, cruise: tc, brake: tb, touchdown: vt } = plan
  if (tau <= 0) return { s: 0, v: 0, brake: 0 }
  if (tau < ta) {
    const x = tau / ta
    return { s: V * ta * (x * x * x - (x * x * x * x) / 2), v: V * x * x * (3 - 2 * x), brake: 0 }
  }
  const cruised = (V * ta) / 2
  if (tau < ta + tc || tb === 0) return { s: Math.min(plan.length, cruised + V * (tau - ta)), v: V, brake: 0 }
  const x = Math.min(1, (tau - ta - tc) / tb)
  const eased = x * x * x - (x * x * x * x) / 2
  return { s: cruised + V * tc + tb * (vt * x + (V - vt) * (x - eased)), v: vt + (V - vt) * (1 - x * x * (3 - 2 * x)), brake: x }
}

const _tangent = new Vector3()
const _ahead = new Vector3()

/**
 * Heading of the curve's tangent. While it climbs or drops straight (or drifts backwards), the heading of the trip
 * instead: turning from the start heading to the departure one at the take-off, then never facing back.
 */
function headingAt(plan: FlightPlan, tangent: Vector3, tau: number): number {
  const fallback = lerpAngle(plan.startYaw, plan.departYaw, smoothstep(0, 0.5, tau))
  const ahead = tangent.x * Math.sin(fallback) + tangent.z * Math.cos(fallback)
  const w = Math.max(0, 0.3 - ahead) * 4
  return Math.atan2(tangent.x + Math.sin(fallback) * w, tangent.z + Math.cos(fallback) * w)
}

/** Where Nova is `t` seconds into the flight, how it moves and how its body lies in the air. */
export function sampleFlight(plan: FlightPlan, t: number, out: FlightSample): FlightSample {
  const end = plan.curve.points[plan.curve.points.length - 1]
  if (t < CROUCH_SECONDS) {
    out.phase = 'crouch'
    out.position.copy(plan.curve.points[0])
    out.velocity.set(0, 0, 0)
    out.speed = 0
    out.yaw = plan.startYaw
    out.pitch = out.roll = 0
    out.thrust = 0.25 * smoothstep(0, CROUCH_SECONDS, t)
    return out
  }
  if (plan.lands && t >= plan.arrival) {
    out.phase = 'landing'
    out.position.copy(end)
    out.velocity.set(0, 0, 0)
    out.speed = 0
    out.yaw = headingAt(plan, plan.curve.getTangentAt(1, _tangent), Infinity)
    out.pitch = out.roll = 0
    out.thrust = Math.max(0, 0.7 - (t - plan.arrival) * 2)
    return out
  }
  const tau = t - CROUCH_SECONDS
  const { s, v, brake } = travel(plan, tau)
  const u = clamp(s / plan.length, 0, 1)
  plan.curve.getPointAt(u, out.position)
  plan.curve.getTangentAt(u, _tangent).normalize()
  out.velocity.copy(_tangent).multiplyScalar(v)
  out.speed = v / CRUISE_SPEED
  out.phase = tau < plan.accel ? 'takeoff' : brake > 0 ? 'flare' : 'cruise'
  out.yaw = headingAt(plan, _tangent, tau)

  // the body lies along the velocity once it has some speed; the flare swings it upright, feet first
  const flare = smoothstep(0.25, 0.8, brake)
  const along = Math.min(Math.acos(clamp(_tangent.y, -1, 1)), MAX_PITCH) * smoothstep(0.08, 0.45, out.speed)
  out.pitch = lerp(along, 0.1, flare)

  // banking into the turns: lateral acceleration v²·dψ/ds
  const ds = 1.5
  plan.curve.getTangentAt(Math.min(1, (s + ds) / plan.length), _ahead).normalize()
  const turn = wrapAngle(headingAt(plan, _ahead, tau) - out.yaw) / ds
  const level = Math.hypot(_tangent.x, _tangent.z)
  out.roll = clamp(-Math.atan((v * v * turn) / BANK_G), -MAX_BANK, MAX_BANK) * level * (1 - flare)

  out.thrust = out.phase === 'takeoff' ? 1 : out.phase === 'flare' ? 0.6 + 0.4 * flare : 0.65
  return out
}

const UP = new Vector3(0, 1, 0)
const FORWARD = new Vector3(0, 0, 1)
const SIDE = new Vector3(1, 0, 0)
const _yaw = new Quaternion()
const _roll = new Quaternion()
const _pitch = new Quaternion()
const _pivot = new Vector3()

/** Nova's body in the air: heading, then banked around the travel direction, then tilted head first (pitch about its own side). */
export function flightQuaternion(yaw: number, pitch: number, roll: number, out: Quaternion): Quaternion {
  _yaw.setFromAxisAngle(UP, yaw)
  _roll.setFromAxisAngle(FORWARD, roll)
  _pitch.setFromAxisAngle(SIDE, pitch)
  return out.copy(_yaw).multiply(_roll).multiply(_pitch)
}

/**
 * Places Nova's frame (feet at its origin, `scale` tall) for a pose of the flight: the body turns around its waist,
 * so tilting into the flight does not swing it around its feet.
 */
export function novaFlightFrame(
  nova: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number },
  scale: number,
  position: Vector3,
  quaternion: Quaternion,
): void {
  flightQuaternion(nova.yaw, nova.pitch, nova.roll, quaternion)
  _pivot.set(0, FLIGHT_PIVOT * scale, 0)
  position.set(nova.x, nova.y, nova.z).add(_pivot).sub(_pivot.applyQuaternion(quaternion))
}
