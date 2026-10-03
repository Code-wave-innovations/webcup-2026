import { Vector3 } from 'three'

/** Direction of the sun seen from the ship. */
export const SUN_DIRECTION = new Vector3(-0.4, 0.36, -0.845).normalize()

/** Where Terra Nova's city sits on the planet (unit sphere, before the planet's own rotation). */
export const CITY_ON_PLANET = new Vector3(0.5, 0.2, 0.84).normalize()
/** The planet is turned so the city faces the ship along this direction. */
export const CITY_FACING = new Vector3(0.2, -0.2, 0.96).normalize()

export const PLANET_RADIUS = 3
/** During the entry the planet rushes to fill the canopy. */
export const PLANET_ENTRY_POSITION = new Vector3(-0.35, 0.55, -3.46)

/** Framing per screen shape: wide screens put the planet left and the hologram right, phones put the planet on top. */
export function frameCockpit(aspect: number) {
  if (aspect < 0.8) return { fov: 74, planet: new Vector3(0.15, 5.2, -14) }
  if (aspect < 1.25) return { fov: 64, planet: new Vector3(-0.6, 1.5, -10) }
  return { fov: 55, planet: new Vector3(-2.1, 0.75, -9) }
}
