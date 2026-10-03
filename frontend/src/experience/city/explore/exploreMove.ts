import { damp } from '../../../lib/math'
import type { ExploreRoam } from '../../director/FilmDirector'
import type { POI } from '../cityConfig'
import { exploreCollision } from './exploreCollision'

const WALK_SPEED = 3.4
const TURN = 10

/**
 * Moves Nova on the terrain of `site` from the WASD / joystick stick, facing the camera's yaw.
 * Returns the distance travelled this frame (world units).
 */
export function tickExploreMove(roam: ExploreRoam, dt: number, site: POI | null): number {
  const step = Math.min(dt, 0.1)
  const { move, orbit, nova } = roam
  const stick = Math.hypot(move.x, move.z)
  if (stick < 0.04) {
    nova.speed += (0 - nova.speed) * damp(12, step)
    return nova.speed * step
  }
  const inv = 1 / stick
  const mx = move.x * inv
  const mz = move.z * inv
  const sy = Math.sin(orbit.yaw)
  const cy = Math.cos(orbit.yaw)
  // camera sits at +yaw behind Nova; stick Z is forward (into the view), X is strafe
  const dx = (-sy * mz + cy * mx) * WALK_SPEED * step * Math.min(1, stick)
  const dz = (-cy * mz - sy * mx) * WALK_SPEED * step * Math.min(1, stick)
  const hit = exploreCollision()?.resolve(nova.x, nova.z, dx, dz, site)
  if (hit) {
    nova.x = hit.x
    nova.z = hit.z
    nova.y = hit.y
  } else {
    nova.x += dx
    nova.z += dz
  }
  const heading = Math.atan2(dx, dz)
  let yaw = heading - nova.yaw
  yaw = yaw - Math.PI * 2 * Math.round(yaw / (Math.PI * 2))
  nova.yaw += yaw * damp(TURN, step)
  nova.speed += (WALK_SPEED * Math.min(1, stick) - nova.speed) * damp(10, step)
  return Math.hypot(dx, dz)
}
