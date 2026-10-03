/** Fixed geography of Terra Nova: everything else (towers, shuttles) is generated from a seed around it. */

export const CITY_CENTER = { x: 0, z: -4 } as const
/** Where the flyover starts: the valley in front of it stays clear of mountains. */
export const FIRST_VIEWPOINT = { x: -6, z: 150 } as const

/** Azimuth of the setting sun (horizontal unit vector). */
export const SUN_AZIMUTH = (() => {
  const length = Math.hypot(0.3, 0.954)
  return { x: 0.3 / length, z: -0.954 / length }
})()

export interface Dome {
  id: 'central' | 'serre' | 'trois' | 'd4' | 'd5' | 'd6'
  x: number
  z: number
  r: number
  /** greenhouse: green interior light */
  greenhouse?: boolean
}

export const DOMES: readonly Dome[] = [
  { id: 'central', x: 10, z: 8, r: 9 },
  { id: 'serre', x: -24, z: 10, r: 6.5, greenhouse: true },
  { id: 'trois', x: 26, z: -6, r: 6.2 },
  { id: 'd4', x: -14, z: -27, r: 4 },
  { id: 'd5', x: 19, z: -25, r: 4.5 },
  { id: 'd6', x: -33, z: -13, r: 3.5 },
]

/** Domes sit on a 1.3 high plinth and are flattened to 78 % of their radius. */
export const DOME_BASE = 1.3
export const DOME_FLATTEN = 0.78

export const COUNCIL_TOWER = { x: -4, z: -10, h: 50 } as const

/** The ring road around the center. */
export const RING = { radius: 35, height: 3.7, tube: 0.42 } as const

/** The bridge over the lake, from the ring to the valley road. */
export const BRIDGE_PATH: ReadonlyArray<readonly [number, number, number]> = [
  [0, 3.7, 31], [2, 4.1, 50], [5, 4.1, 70], [4, 3.8, 92], [-2, 3.3, 114], [-8, 2.6, 150], [-13, 2.4, 205], [-10, 2.4, 270],
]

export const CITY_SEED = 20260310
