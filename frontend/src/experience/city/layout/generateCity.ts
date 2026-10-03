import { clamp } from '../../../lib/math'
import { createRandom } from '../../../lib/random'
import { CITY_CENTER, CITY_SEED, COUNCIL_TOWER, DOMES, SUN_AZIMUTH } from '../cityConfig'
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
}

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
  const shuttles = Array.from({ length: light ? 4 : 7 }, () => {
    const radiusX = 20 + random() * 46
    const radiusZ = 16 + random() * 40
    const altitude = 10 + random() * 34
    const speed = (0.05 + random() * 0.07) * (random() < 0.5 ? -1 : 1)
    const phase = random() * 6.28
    const tilt = random() * 0.5
    return { radiusX, radiusZ, altitude, speed, phase, tilt }
  })
  return { terrain, horizonAtCenter: horizonFrom(heights, CITY_CENTER.x, 1.2, CITY_CENTER.z), towers, beaconPhases, shuttles }
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
  const towers: Tower[] = [{ x: COUNCIL_TOWER.x, z: COUNCIL_TOWER.z, width: 5.4, height: COUNCIL_TOWER.h, seed: 0.37, kind: 0 }]
  let attempts = 0
  while (towers.length < count && attempts++ < 6000) {
    const angle = random() * 6.2832
    const r = Math.sqrt(random()) * CITY_RADIUS
    const x = CITY_CENTER.x + Math.cos(angle) * r
    const z = CITY_CENTER.z + Math.sin(angle) * r
    if (relief(x, z) < 0.7) continue
    if (z > 4 && Math.abs(x - 0.42 * (31 - z) * 0.9) < 6.5) continue
    if (x > 24 && Math.abs(z + 6 - (x - 26) * 0.54) < 8.5) continue
    const height = (6 + 30 * Math.pow(1 - r / CITY_RADIUS, 1.25)) * (0.5 + 0.95 * random())
    const width = 1.7 + random() * 2.2 + height * 0.04
    const blocked =
      DOMES.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + width * 0.5 + 1.2) ||
      towers.some((t) => Math.hypot(x - t.x, z - t.z) < (width + t.width) * 0.52)
    if (blocked) continue
    const seed = random()
    const kind = random() < 0.46 ? 0 : random() < 0.62 ? 1 : 2
    towers.push({ x, z, width, height, seed, kind })
  }
  return towers
}
