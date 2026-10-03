import { clamp } from '../../../lib/math'
import { createRandom } from '../../../lib/random'
import { CITY_CENTER, CITY_SEED, COUNCIL_SPIRES, COUNCIL_TOWER, DOMES, OBSERVATORY, RING, SUN_AZIMUTH } from '../cityConfig'
import { bakeGroundShadows, type Footprint } from './cityGround'
import { relief } from './relief'

export interface Tower {
  x: number
  z: number
  width: number
  height: number
  /** per-tower random value: rotation, window pattern, beacon colour */
  seed: number
  /** silhouette: 0 stepped spire, 1 tapered, 2 block */
  kind: 0 | 1 | 2
}

export interface ShuttleRoute {
  radiusX: number
  radiusZ: number
  altitude: number
  speed: number
  phase: number
  tilt: number
}

/** Everything about the city that is computed rather than authored (built off the main thread). */
export interface CityData {
  terrain: {
    segments: number
    /** vertex positions in PlaneGeometry(2, 2, segments, segments).rotateX(-π/2) order */
    positions: Float32Array
    /** per vertex: tangent of the highest obstacle towards the setting sun (cast shadows) */
    horizon: Float32Array
  }
  /** same horizon value at the city centre: tower bases fall into shadow below it */
  horizonAtCenter: number
  towers: Tower[]
  /** blink phase of each tower's beacon, in `towers` order */
  beaconPhases: Float32Array
  shuttles: ShuttleRoute[]
  /** low-rise urban fabric, LOW_RISE_STRIDE floats each: x, ground y, z, width, depth, height, rotation, seed */
  lowRise: Float32Array
  /** trees of the terraces and the avenue, TREE_STRIDE floats each: x, ground y, z, size, seed */
  trees: Float32Array
  /** soft ground shadows over `GROUND_MAP` (RGBA: R contact occlusion, G cast shadow) */
  groundShadows: Uint8Array
}

export const LOW_RISE_STRIDE = 8
export const TREE_STRIDE = 5

const GRID = 300
const GRID_EXTENT = 950
const CITY_RADIUS = 33

/** Builds the terrain mesh data, its sun shadows and the seeded city layout. Deterministic. */
export function generateCity(light: boolean): CityData {
  const heights = sampleHeightGrid()
  const terrain = buildTerrain(light ? 230 : 340, heights)
  const random = createRandom(CITY_SEED)
  const towers = placeTowers(light ? 76 : 128, random)
  const beaconPhases = Float32Array.from(towers, () => random())
  const occupied = new Occupancy()
  towers.forEach((t) => occupied.add(t.x, t.z, t.width * 0.55))
  DOMES.forEach((d) => occupied.add(d.x, d.z, d.r + 0.6))
  occupied.add(OBSERVATORY.x, OBSERVATORY.z, OBSERVATORY.radius + 1.2)
  const trees = plantTrees(light ? 220 : 420, random, occupied)
  const lowRise = buildLowRise(light ? 500 : 1000, random, occupied)
  const shuttles = Array.from({ length: light ? 4 : 7 }, () => {
    const radiusX = 20 + random() * 46
    const radiusZ = 16 + random() * 40
    const altitude = 10 + random() * 34
    const speed = (0.05 + random() * 0.07) * (random() < 0.5 ? -1 : 1)
    const phase = random() * 6.28
    const tilt = random() * 0.5
    return { radiusX, radiusZ, altitude, speed, phase, tilt }
  })
  const groundShadows = bakeGroundShadows(footprints(towers, lowRise))
  return { terrain, horizonAtCenter: horizonFrom(heights, CITY_CENTER.x, 1.2, CITY_CENTER.z), towers, beaconPhases, shuttles, lowRise, trees, groundShadows }
}

/** Coarse height grid, bilinearly sampled by the shadow march (much cheaper than `relief`). */
function sampleHeightGrid(): Float32Array {
  const grid = new Float32Array(GRID * GRID)
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      grid[j * GRID + i] = relief(-GRID_EXTENT + (2 * GRID_EXTENT * i) / (GRID - 1), -GRID_EXTENT + (2 * GRID_EXTENT * j) / (GRID - 1))
    }
  }
  return grid
}

function gridHeight(grid: Float32Array, x: number, z: number): number {
  const u = clamp(((x + GRID_EXTENT) / (2 * GRID_EXTENT)) * (GRID - 1), 0, GRID - 1.001)
  const v = clamp(((z + GRID_EXTENT) / (2 * GRID_EXTENT)) * (GRID - 1), 0, GRID - 1.001)
  const iu = u | 0
  const iv = v | 0
  const fu = u - iu
  const fv = v - iv
  const k = iv * GRID + iu
  return (grid[k] * (1 - fu) + grid[k + 1] * fu) * (1 - fv) + (grid[k + GRID] * (1 - fu) + grid[k + GRID + 1] * fu) * fv
}

/** Marches towards the setting sun and keeps the steepest obstacle (the sun is hidden below that slope). */
function horizonFrom(grid: Float32Array, x: number, y: number, z: number): number {
  let distance = 6
  let step = 4
  let steepest = -0.2
  for (let s = 0; s < 40; s++) {
    const slope = (gridHeight(grid, x + SUN_AZIMUTH.x * distance, z + SUN_AZIMUTH.z * distance) - y) / distance
    if (slope > steepest) steepest = slope
    distance += step
    step *= 1.1
  }
  return steepest
}

/** A plane whose vertices are pushed out cubically: dense around the city, sparse on the far mountains. */
function buildTerrain(segments: number, grid: Float32Array): CityData['terrain'] {
  const side = segments + 1
  const positions = new Float32Array(side * side * 3)
  const horizon = new Float32Array(side * side)
  for (let iy = 0; iy < side; iy++) {
    for (let ix = 0; ix < side; ix++) {
      const i = iy * side + ix
      const u = (ix * 2) / segments - 1
      const v = (iy * 2) / segments - 1
      const x = 300 * u + 1500 * u * u * u
      const z = 55 + 300 * v + 1500 * v * v * v
      const y = relief(x, z)
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      horizon[i] = horizonFrom(grid, x, y, z)
    }
  }
  return { segments, positions, horizon }
}

/**
 * Scatters towers in the basin, taller towards the centre, keeping clear of the water, the domes,
 * the avenue from the bridge to the central dome and the view onto dome 3. The council tower comes first.
 */
function placeTowers(count: number, random: () => number): Tower[] {
  const towers: Tower[] = [
    { x: COUNCIL_TOWER.x, z: COUNCIL_TOWER.z, width: 5.4, height: COUNCIL_TOWER.h, seed: 0.37, kind: 0 },
    ...COUNCIL_SPIRES.map((spire, i) => ({ x: spire.x, z: spire.z, width: 2.6, height: spire.h, seed: 0.61 + i * 0.17, kind: 0 as const })),
  ]
  let attempts = 0
  while (towers.length < count && attempts++ < 6000) {
    const angle = random() * 6.2832
    const r = Math.sqrt(random()) * CITY_RADIUS
    const x = CITY_CENTER.x + Math.cos(angle) * r
    const z = CITY_CENTER.z + Math.sin(angle) * r
    if (relief(x, z) < 0.7) continue
    if (inCorridor(x, z, 0)) continue
    const height = (6 + 30 * Math.pow(1 - r / CITY_RADIUS, 1.25)) * (0.5 + 0.95 * random())
    const width = 1.7 + random() * 2.2 + height * 0.04
    const blocked =
      DOMES.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + width * 0.5 + 1.2) ||
      Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z) < OBSERVATORY.radius + width * 0.5 + 2.5 ||
      towers.some((t) => Math.hypot(x - t.x, z - t.z) < (width + t.width) * 0.52)
    if (blocked) continue
    const seed = random()
    const kind = random() < 0.46 ? 0 : random() < 0.62 ? 1 : 2
    towers.push({ x, z, width, height, seed, kind })
  }
  return towers
}

/** Keeps the avenue from the bridge to the central dome and the view onto dome 3 clear. */
function inCorridor(x: number, z: number, margin: number): boolean {
  if (z > 4 && Math.abs(x - 0.42 * (31 - z) * 0.9) < 6.5 + margin) return true
  return x > 24 && Math.abs(z + 6 - (x - 26) * 0.54) < 8.5 + margin
}

/** Distance to the nearest of the six radial avenues drawn on the city floor (see terrain.frag). */
function avenueDistance(x: number, z: number): number {
  const qx = x - CITY_CENTER.x
  const qz = z - CITY_CENTER.z
  const sector = Math.PI / 3
  const angle = Math.atan2(qz, qx) + sector / 2
  const a6 = Math.abs((((angle % sector) + sector) % sector) - sector / 2)
  return Math.hypot(qx, qz) * Math.sin(a6)
}

/** What is already built, as discs in a coarse grid (fast overlap tests for a thousand blocks). */
class Occupancy {
  private readonly cells = new Map<number, Array<readonly [number, number, number]>>()
  private static readonly CELL = 6

  private key(i: number, j: number) {
    return (i + 500) * 1000 + j + 500
  }

  add(x: number, z: number, r: number) {
    const c = Occupancy.CELL
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const k = this.key(i, j)
        const list = this.cells.get(k)
        if (list) list.push([x, z, r])
        else this.cells.set(k, [[x, z, r]])
      }
    }
  }

  free(x: number, z: number, r: number): boolean {
    const list = this.cells.get(this.key(Math.floor(x / Occupancy.CELL), Math.floor(z / Occupancy.CELL)))
    if (!list) return true
    for (const [ox, oz, or] of list) if (Math.hypot(x - ox, z - oz) < r + or) return false
    return true
  }
}

/** Terraced gardens around the domes, and two rows of trees along the avenue. */
function plantTrees(count: number, random: () => number, occupied: Occupancy): Float32Array {
  const out: number[] = []
  const plant = (x: number, z: number, size: number): boolean => {
    if (!occupied.free(x, z, size * 0.42)) return false
    const y = relief(x, z)
    if (y < 0.7) return false
    occupied.add(x, z, size * 0.4)
    out.push(x, y, z, size, random())
    return true
  }
  const terraces = Math.round(count * 0.72)
  const perimeter = DOMES.reduce((sum, d) => sum + d.r + 2.6, 0)
  for (const dome of DOMES) {
    const share = Math.round((terraces * (dome.r + 2.6)) / perimeter)
    for (let n = 0, tries = 0; n < share && tries < share * 6; tries++) {
      const angle = random() * Math.PI * 2
      // three terraces, the outer ones lower and sparser
      const ring = random() < 0.55 ? 0 : random() < 0.6 ? 1 : 2
      const r = dome.r + 1.5 + ring * 1.3 + random() * 0.8
      if (plant(dome.x + Math.cos(angle) * r, dome.z + Math.sin(angle) * r, 0.7 + random() * 0.6 - ring * 0.1)) n++
    }
  }
  for (let z = 6; z < 30 && out.length / TREE_STRIDE < count; z += 1.6) {
    const x = 0.42 * (31 - z) * 0.9
    for (const side of [-1, 1]) plant(x + side * (4.4 + random() * 0.6), z + random() * 0.4, 0.8 + random() * 0.4)
  }
  return Float32Array.from(out)
}

/**
 * The urban fabric between the towers: low blocks aligned with the hexagonal streets, taller towards the
 * centre, keeping the avenues, the ring road, the water and the view corridors clear.
 */
function buildLowRise(count: number, random: () => number, occupied: Occupancy): Float32Array {
  const out: number[] = []
  let attempts = 0
  const reach = CITY_RADIUS + 15
  while (out.length / LOW_RISE_STRIDE < count && attempts++ < count * 30) {
    const angle = random() * Math.PI * 2
    const r = Math.sqrt(random()) * reach
    const x = CITY_CENTER.x + Math.cos(angle) * r
    const z = CITY_CENTER.z + Math.sin(angle) * r
    if (Math.abs(r - RING.radius) < 1.6 || inCorridor(x, z, -1.5) || avenueDistance(x, z) < 1.3) continue
    // smaller and lower out in the suburbs, beyond the ring road
    const suburb = r > RING.radius
    const width = (0.8 + random() * 1.2) * (suburb ? 0.85 : 1)
    const depth = (0.8 + random() * 1.2) * (suburb ? 0.85 : 1)
    const radius = Math.max(width, depth) * 0.5
    if (!occupied.free(x, z, radius + 0.25)) continue
    const y = relief(x, z)
    // above the water, on the flat of the basin (not up the slopes)
    if (y < 0.7 || y > 3) continue
    occupied.add(x, z, radius)
    const height = (0.9 + random() * 2.2) * (suburb ? 0.7 : 1 + 0.8 * (1 - r / RING.radius))
    // facing the centre, like the hexagonal blocks of the streets
    out.push(x, y, z, width, depth, height, angle, random())
  }
  return Float32Array.from(out)
}

/** Everything that stands on the ground, for the baked shadows. */
function footprints(towers: readonly Tower[], lowRise: Float32Array): Footprint[] {
  const list: Footprint[] = towers.map((t) => ({ x: t.x, z: t.z, halfX: t.width * 0.45, halfZ: t.width * 0.45, rotation: 0, height: t.height, box: false }))
  for (const d of DOMES) list.push({ x: d.x, z: d.z, halfX: d.r, halfZ: d.r, rotation: 0, height: d.r * 0.9, box: false })
  list.push({ x: OBSERVATORY.x, z: OBSERVATORY.z, halfX: OBSERVATORY.radius, halfZ: OBSERVATORY.radius, rotation: 0, height: OBSERVATORY.h, box: false })
  for (let i = 0; i < lowRise.length; i += LOW_RISE_STRIDE) {
    list.push({ x: lowRise[i], z: lowRise[i + 2], halfX: lowRise[i + 3] / 2, halfZ: lowRise[i + 4] / 2, rotation: lowRise[i + 6], height: lowRise[i + 5], box: true })
  }
  return list
}
