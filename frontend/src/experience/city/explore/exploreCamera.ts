import { Vector3 } from 'three'
import { clamp, damp, lerp, smoothstep } from '../../../lib/math'
import { relief } from '../layout/relief'
import type { ExploreRoam } from '../../director/FilmDirector'
import type { PoiId } from '../cityConfig'
import { boomClearance } from './exploreCollision'
import type { FlightSample } from './flightPath'

export const EXPLORE_DISTANCE = 8
export const EXPLORE_LOOK = 1.2
export const EXPLORE_FOCAL = 50
export const EXPLORE_PITCH_MIN = 0.14
export const EXPLORE_PITCH_MAX = 1.05

/**
 * chase camera: a three-quarter rear view, above and to the side (straight from behind, a body lying along the
 * flight shrinks to its shoulders); further back and wider as the speed builds
 */
const CHASE_DISTANCE = 5.2
const CHASE_SIDE = 2.4
const CHASE_LIFT = 2
const FLIGHT_FOCAL = 58
const AIM_SMOOTH = 0.14
/** the landing is framed from a low three-quarter front (orbit yaw from the arrival heading) */
export const LANDING_ORBIT = { yaw: 0.75, pitch: 0.2 }

export interface ExploreView {
  position: Vector3
  target: Vector3
  focal: number
}

/**
 * Third-person follow camera: behind Nova on a sphere, looking at its head, lifted off the terrain.
 */
export function sampleExploreCamera(roam: ExploreRoam, out: ExploreView): ExploreView {
  const { nova, orbit } = roam
  const pitch = clamp(orbit.pitch, EXPLORE_PITCH_MIN, EXPLORE_PITCH_MAX)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  out.target.set(nova.x, nova.y + EXPLORE_LOOK, nova.z)
  out.position.set(
    nova.x + Math.sin(orbit.yaw) * cp * EXPLORE_DISTANCE,
    nova.y + EXPLORE_LOOK + sp * EXPLORE_DISTANCE,
    nova.z + Math.cos(orbit.yaw) * cp * EXPLORE_DISTANCE,
  )
  liftOffGround(out.position, 1.5)
  out.focal = EXPLORE_FOCAL
  return out
}

/** Shortens the orbit's boom to what is clear between Nova's head and the camera. */
function pullIn(view: ExploreView, site: PoiId | null) {
  const clear = boomClearance(view.target, view.position, site)
  if (clear < 1) view.position.lerp(view.target, 1 - Math.max(0.18, clear - 0.04))
}

function liftOffGround(p: Vector3, clearance: number) {
  const floor = Math.max(relief(p.x, p.z), 0) + clearance
  if (p.y < floor) p.y = floor
}

/** Critically damped spring towards `goal` (game programming gems' SmoothDamp): no overshoot, stable at any frame time. */
function smoothDamp(current: Vector3, goal: Vector3, velocity: Vector3, smoothTime: number, dt: number) {
  const omega = 2 / Math.max(1e-4, smoothTime)
  const x = omega * dt
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  for (const axis of ['x', 'y', 'z'] as const) {
    const change = current[axis] - goal[axis]
    const temp = (velocity[axis] + omega * change) * dt
    velocity[axis] = (velocity[axis] - omega * temp) * decay
    current[axis] = goal[axis] + (change + temp) * decay
  }
}

/**
 * The explore camera: springs that chase a goal pose. It starts on the flyover camera's pose, so going into the
 * flight never cuts; in flight it trails Nova along its smoothed horizontal heading (it never jumps above Nova when
 * the flight goes vertical), then swoops onto the landing and settles into the third-person orbit.
 */
export class ExploreCameraRig {
  readonly view: ExploreView = { position: new Vector3(), target: new Vector3(), focal: EXPLORE_FOCAL }
  private readonly velocity = new Vector3()
  private readonly targetVelocity = new Vector3()
  private readonly heading = new Vector3(0, 0, 1)
  private readonly goal: ExploreView = { position: new Vector3(), target: new Vector3(), focal: EXPLORE_FOCAL }
  private readonly orbitGoal: ExploreView = { position: new Vector3(), target: new Vector3(), focal: EXPLORE_FOCAL }
  private readonly centre = new Vector3()

  /** Starts on a given pose; the chase heading starts along its line of sight. */
  reset(position: Vector3, target: Vector3, focal: number): void {
    this.view.position.copy(position)
    this.view.target.copy(target)
    this.view.focal = focal
    this.velocity.set(0, 0, 0)
    this.targetVelocity.set(0, 0, 0)
    this.heading.set(target.x - position.x, 0, target.z - position.z)
    if (this.heading.lengthSq() < 1e-6) this.heading.set(0, 0, 1)
    this.heading.normalize()
  }

  /** Jumps straight onto the ground orbit (reduced motion, debug landings). */
  snapToOrbit(roam: ExploreRoam, site: PoiId | null): void {
    sampleExploreCamera(roam, this.orbitGoal)
    pullIn(this.orbitGoal, site)
    this.reset(this.orbitGoal.position, this.orbitGoal.target, this.orbitGoal.focal)
  }

  /** Walking on `site`: the orbit behind Nova, followed closely, pulled in when a wall or the slope gets in between. */
  followOrbit(roam: ExploreRoam, site: PoiId | null, dt: number): ExploreView {
    sampleExploreCamera(roam, this.goal)
    pullIn(this.goal, site)
    return this.step(this.goal, 0.12, 0.06, 6, dt)
  }

  /**
   * Flying: behind Nova along its heading; `landing` (0 → 1 through the flare) blends towards the orbit pose that
   * frames the touchdown. `hold` keeps the camera where it is and only looks up after Nova (the way back to the sky).
   */
  followFlight(roam: ExploreRoam, flight: FlightSample, landing: number, destination: PoiId | null, dt: number): ExploreView {
    const hold = destination === null
    const { nova } = roam
    const centre = this.centre.set(nova.x, nova.y + 0.9, nova.z)
    const horizontal = Math.hypot(flight.velocity.x, flight.velocity.z)
    if (horizontal > 2) {
      const k = damp(2.2, dt)
      this.heading.x += (flight.velocity.x / horizontal - this.heading.x) * k
      this.heading.z += (flight.velocity.z / horizontal - this.heading.z) * k
      this.heading.normalize()
    }
    const goal = this.goal
    if (hold) {
      goal.position.copy(this.view.position)
      goal.target.copy(centre)
      goal.focal = lerp(this.view.focal, EXPLORE_FOCAL + 6, damp(2, dt))
      return this.step(goal, 0.6, 0.22, 3, dt)
    }
    const pace = clamp(flight.speed, 0, 1)
    goal.position.copy(centre).addScaledVector(this.heading, -(CHASE_DISTANCE + 1.6 * pace))
    goal.position.x += this.heading.z * CHASE_SIDE * pace
    goal.position.z -= this.heading.x * CHASE_SIDE * pace
    goal.position.y += CHASE_LIFT + 0.8 * pace
    goal.target.copy(centre).addScaledVector(flight.velocity, 0.09)
    goal.focal = lerp(EXPLORE_FOCAL, FLIGHT_FOCAL, smoothstep(0.1, 0.9, pace))
    if (landing > 0) {
      sampleExploreCamera(roam, this.orbitGoal)
      pullIn(this.orbitGoal, destination)
      goal.position.lerp(this.orbitGoal.position, landing)
      goal.target.lerp(this.orbitGoal.target, landing)
      goal.focal = lerp(goal.focal, this.orbitGoal.focal, landing)
    }
    // lead the springs by the flight's velocity, so they do not trail behind by speed × smoothing time
    const smooth = lerp(0.5, 0.3, landing)
    const lead = 1 - landing
    goal.position.addScaledVector(flight.velocity, smooth * lead)
    goal.target.addScaledVector(flight.velocity, AIM_SMOOTH * lead)
    liftOffGround(goal.position, 2)
    return this.step(goal, smooth, AIM_SMOOTH, 3, dt)
  }

  private step(goal: ExploreView, smooth: number, aimSmooth: number, zoom: number, dt: number): ExploreView {
    const step = Math.min(dt, 0.1)
    smoothDamp(this.view.position, goal.position, this.velocity, smooth, step)
    smoothDamp(this.view.target, goal.target, this.targetVelocity, aimSmooth, step)
    this.view.focal += (goal.focal - this.view.focal) * damp(zoom, step)
    liftOffGround(this.view.position, 1.2)
    return this.view
  }
}
