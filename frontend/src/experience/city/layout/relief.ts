import { smoothstep } from '../../../lib/math'
import { CITY_CENTER, FIRST_VIEWPOINT, POIS, SUN_AZIMUTH } from '../cityConfig'

/*
 * The landscape around the city, as a pure height function (CPU side, also used to place towers).
 * Value noise, fbm and ridged fbm, then shaping: a flat basin for the city, a valley along the river,
 * a gap in the mountains towards the setting sun, a lake and a river carved below water level.
 */

function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  let fx = x - ix
  let fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

export function fbm(x: number, z: number, octaves: number): number {
  let sum = 0
  let amplitude = 0.5
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x, z)
    x = x * 2.03 + 17.1
    z = z * 2.03 + 9.3
    amplitude *= 0.5
  }
  return sum
}

function ridges(x: number, z: number, octaves: number): number {
  let sum = 0
  let amplitude = 0.5
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x, z) * 2 - 1)
    sum += amplitude * n * n
    x = x * 2.1 + 4.7
    z = z * 2.1 + 2.9
    amplitude *= 0.5
  }
  return sum
}

/** Centre line of the river that feeds the lake from the south. */
function riverAxis(z: number): number {
  return 6 - 10 * Math.sin((z - 82) * 0.012) + 5 * Math.sin(z * 0.047)
}

/** Ground height at (x, z) before the sites are levelled; below 0 is water. */
export function naturalRelief(x: number, z: number): number {
  const dx = x - CITY_CENTER.x
  const dz = z - CITY_CENTER.z
  const d = Math.sqrt(dx * dx + dz * dz)
  const wx = x + 22 * (fbm(x * 0.008 + 3.1, z * 0.008, 3) - 0.5)
  const wz = z + 22 * (fbm(x * 0.008, z * 0.008 + 8.4, 3) - 0.5)
  const m = ridges(wx * 0.0062, wz * 0.0062, 5)
  const n = fbm(wx * 0.017, wz * 0.017, 5)
  let mountains = Math.pow(m, 1.5) * 150 + n * 14
  const basin = smoothstep(44, 135, d)
  const valley = smoothstep(30, 125, Math.abs(x - riverAxis(z)))
  const south = smoothstep(25, 70, z)
  const mask = basin * (1 - south * (1 - valley))
  const ex = x - FIRST_VIEWPOINT.x
  const ez = z - FIRST_VIEWPOINT.z
  const el = Math.sqrt(ex * ex + ez * ez) + 1e-3
  mountains *= 1 - 0.8 * smoothstep(0.955, 0.998, (ex * SUN_AZIMUTH.x + ez * SUN_AZIMUTH.z) / el)
  const height = mask * mountains + 1.2 + (n - 0.5) * 1.6 * (0.25 + mask)
  const shore = (fbm(x * 0.045 + 5.2, z * 0.045, 3) - 0.5) * 13
  const lake = (Math.sqrt(Math.pow((x - 6) / 52, 2) + Math.pow((z - 58) / 24, 2)) - 1) * 24 + shore
  const river = z > 70 ? Math.abs(x - riverAxis(z)) - 6.5 - smoothstep(95, 150, z) * 15 + shore * 0.6 : 1e3
  const bank = smoothstep(-2, 6, Math.min(lake, river))
  return height * bank - 2.6 * (1 - bank)
}

let plateaus: Float32Array | null = null

/** Height of each site's plateau: the natural ground averaged over its extent (so levelling digs no crater). */
export function sitePlateaus(): Float32Array {
  if (plateaus) return plateaus
  plateaus = Float32Array.from(POIS, (poi) => {
    let sum = 0
    let n = 0
    for (let ring = 0; ring <= 3; ring++) {
      const r = (poi.radius * ring) / 3
      const steps = ring === 0 ? 1 : 12 * ring
      for (let k = 0; k < steps; k++) {
        const a = (Math.PI * 2 * k) / steps
        sum += naturalRelief(poi.x + Math.cos(a) * r, poi.z + Math.sin(a) * r)
        n++
      }
    }
    return Math.max(sum / n, 0.8)
  })
  return plateaus
}

/** Ground height at (x, z); below 0 is water. The sites are levelled towards their plateau, fading out softly. */
export function relief(x: number, z: number): number {
  let h = naturalRelief(x, z)
  for (let i = 0; i < POIS.length; i++) {
    const poi = POIS[i]
    const dx = x - poi.x
    const dz = z - poi.z
    const reach = poi.radius * 1.8
    if (dx * dx + dz * dz >= reach * reach) continue
    const level = (1 - smoothstep(poi.radius * 0.85, reach, Math.sqrt(dx * dx + dz * dz))) * poi.flatten
    h += (sitePlateaus()[i] - h) * level
  }
  return h
}
