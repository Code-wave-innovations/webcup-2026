/** Fixed geography of Terra Nova: everything else (towers, trees, blocks) is generated from a seed around it. */

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

/** Twin spires flanking the council tower. */
export const COUNCIL_SPIRES: ReadonlyArray<{ x: number; z: number; h: number }> = [
  { x: -9.5, z: -16, h: 36 },
  { x: 2, z: -16.5, h: 34 },
]

/** The Observatory: a slender tower with a balcony under a glass cap, where Nova chats at night. */
export const OBSERVATORY = {
  x: 28,
  z: -21,
  h: 42,
  radius: 2.2,
  /** the glass cap: its base (share of the height) and its radius (share of the width) */
  capAt: 0.93,
  capRadius: 0.3,
} as const

/** The ring road around the center: `height` is the deck's middle, the road surface is ROAD_LIFT above it. */
export const RING = { radius: 35, height: 3.7, tube: 0.42, deckWidth: 6, deckThick: 0.8 } as const

/** Road surface above the path points of the ring and the bridge (where the cars drive). */
export const ROAD_LIFT = RING.deckThick / 2

/**
 * The cable-stayed bridge over the lake: an A-shaped pylon straddling the deck, `pylonAt` metres along the bridge
 * from the ring, its apex `pylonHeight` above the road and a mast above it carrying two fans of stays.
 */
export const BRIDGE = {
  roadHalf: 3.1,
  sidewalk: 0.9,
  depth: 1.6,
  pylonAt: 50,
  pylonHeight: 26,
  mast: 8,
  /** the legs' feet, either side of the deck, on the lake bed */
  legSpread: 5.6,
  /** stays per side in each fan: a short back span towards the ring (the flyover passes by it), a long one south */
  staysBack: 7,
  staysOut: 11,
  staySpacing: 2.6,
} as const

/** The bridge over the lake, from the ring to the valley road. */
export const BRIDGE_PATH: ReadonlyArray<readonly [number, number, number]> = [
  [0, 3.7, 31], [2, 4.1, 50], [5, 4.1, 70], [4, 3.8, 92], [-2, 3.3, 114], [-8, 2.6, 150], [-13, 2.4, 205], [-10, 2.4, 270],
]

export const CITY_SEED = 20260310

/* ─── Sites the visitor can fly to (beyond the ring road, out of the flyover's frames) ─── */

export type PoiId = 'golf' | 'stade' | 'village-est' | 'village-nord'

export interface POI {
  id: PoiId
  name: string
  /** one line shown when Nova lands there */
  blurb: string
  icon: 'golf' | 'stadium' | 'village'
  x: number
  z: number
  /** extent of the site (its decoration and its ground) */
  radius: number
  /** how much of the natural relief is levelled: 1 = flat plateau, 0 = untouched slopes */
  flatten: number
}

/**
 * Sites chosen by a terrain scan: off the camera path, above the water, on gentle ground. The stadium and the golf
 * course sit in the gap towards the setting sun (the flattest land); the villages follow their hillsides.
 */
export const POIS: readonly POI[] = [
  { id: 'golf', name: 'Golf de la Trouée', blurb: 'Neuf hectares de fairways face au soleil couchant.', icon: 'golf', x: 72, z: -120, radius: 34, flatten: 0.6 },
  { id: 'stade', name: 'Stade Nova', blurb: 'Vingt mille places, et la pelouse est arrosée par la pluie du dôme.', icon: 'stadium', x: 45, z: -60, radius: 27, flatten: 1 },
  { id: 'village-est', name: "Village de l'Est", blurb: 'Murs blancs, tuiles rouges et une fontaine sur la place.', icon: 'village', x: 78, z: -24, radius: 20, flatten: 0.45 },
  { id: 'village-nord', name: 'Village du Nord', blurb: 'Des chalets accrochés à la pente, au pied des crêtes.', icon: 'village', x: -20, z: -70, radius: 20, flatten: 0.45 },
]

export const poiById = (id: PoiId): POI => POIS.find((p) => p.id === id)!
