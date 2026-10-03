import { Vector3 } from 'three'

/** Direction of the sun seen from orbit. */
export const SUN_DIRECTION = new Vector3(-0.84, 0.4, -0.08).normalize()

/** Where Terra Nova's city sits on the planet (unit sphere, before the planet's own rotation). */
export const CITY_ON_PLANET = new Vector3(0.5, 0.2, 0.84).normalize()
/** The planet is turned so the city faces the ship along this direction. */
export const CITY_FACING = new Vector3(0.2, -0.2, 0.96).normalize()

export const PLANET_RADIUS = 3
/** During the entry the planet rushes to fill the view. */
export const PLANET_ENTRY_POSITION = new Vector3(-0.35, 0.55, -3.46)

/**
 * Framing per screen shape, seen from orbit: the planet fills the lower left and its lit limb arcs across
 * the frame, the access panel floats on the right; phones put the planet at the top, above the panel.
 */
export function frameOrbit(aspect: number) {
  if (aspect < 0.8) return { fov: 70, planet: new Vector3(-1.4, 4.4, -11) }
  if (aspect < 1.25) return { fov: 60, planet: new Vector3(-1.6, -1.8, -9) }
  return { fov: 50, planet: new Vector3(-2.7, -1.25, -8) }
}
