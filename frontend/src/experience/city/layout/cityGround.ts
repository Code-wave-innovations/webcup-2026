import { CITY_CENTER, SUN_AZIMUTH } from '../cityConfig'

/** Square of the ground covered by the city's shadow map, centred on the city (world units). */
export const GROUND_MAP = { centerX: CITY_CENTER.x, centerZ: CITY_CENTER.z, half: 64, size: 256 } as const

/** A building's footprint seen from above: a disc (towers, domes) or a box (low-rise). */
export interface Footprint {
  x: number
  z: number
  /** disc radius, or box half extents along its own axes */
  halfX: number
  halfZ: number
  rotation: number
  height: number
  box: boolean
}

/** Long shadows of the setting sun: about two building heights. */
const SHADOW_LENGTH = 2.2
const MAX_SHADOW = 42

/**
 * Soft ground shadows of the city, computed once from the footprints: R = contact occlusion around each
 * building, G = the shadow it casts away from the setting sun (fading along its length). Both blurred
 * (three box passes ≈ gaussian). Returns RGBA bytes for a texture over `GROUND_MAP`.
 */
export function bakeGroundShadows(footprints: readonly Footprint[]): Uint8Array {
  const { size, half } = GROUND_MAP
  const texel = (2 * half) / size
  const occlusion = new Float32Array(size * size)
  const cast = new Float32Array(size * size)
  const dirX = -SUN_AZIMUTH.x
  const dirZ = -SUN_AZIMUTH.z

  for (const f of footprints) {
    stamp(occlusion, f, f.x, f.z, 1.1, 1)
    const length = Math.min(MAX_SHADOW, f.height * SHADOW_LENGTH)
    for (let s = 0; s <= length; s += texel) {
      stamp(cast, f, f.x + dirX * s, f.z + dirZ * s, 0, 1 - 0.55 * (s / length))
    }
  }
  blur(occlusion, size, 3)
  blur(cast, size, 2)

  const bytes = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    bytes[i * 4] = Math.round(Math.min(1, occlusion[i]) * 255)
    bytes[i * 4 + 1] = Math.round(Math.min(1, cast[i]) * 255)
    bytes[i * 4 + 3] = 255
  }
  return bytes
}

/** Writes `value` (max) over the footprint moved to (x, z), grown by `grow`. */
function stamp(grid: Float32Array, f: Footprint, x: number, z: number, grow: number, value: number) {
  const { size, half, centerX, centerZ } = GROUND_MAP
  const texel = (2 * half) / size
  const reach = Math.max(f.halfX, f.halfZ) * (f.box ? Math.SQRT2 : 1) + grow
  const cos = Math.cos(f.rotation)
  const sin = Math.sin(f.rotation)
  const i0 = Math.max(0, Math.floor((x - reach - centerX + half) / texel))
  const i1 = Math.min(size - 1, Math.ceil((x + reach - centerX + half) / texel))
  const j0 = Math.max(0, Math.floor((z - reach - centerZ + half) / texel))
  const j1 = Math.min(size - 1, Math.ceil((z + reach - centerZ + half) / texel))
  for (let j = j0; j <= j1; j++) {
    const pz = centerZ - half + (j + 0.5) * texel - z
    for (let i = i0; i <= i1; i++) {
      const px = centerX - half + (i + 0.5) * texel - x
      let inside: boolean
      if (f.box) {
        const u = Math.abs(px * cos + pz * sin)
        const v = Math.abs(px * sin + pz * cos)
        inside = u <= f.halfX + grow && v <= f.halfZ + grow
      } else {
        inside = px * px + pz * pz <= (f.halfX + grow) * (f.halfX + grow)
      }
      if (inside) {
        const k = j * size + i
        if (value > grid[k]) grid[k] = value
      }
    }
  }
}

/** Three separable box blurs of radius `r` texels. */
function blur(grid: Float32Array, size: number, r: number) {
  const tmp = new Float32Array(grid.length)
  const pass = (src: Float32Array, dst: Float32Array, stride: number, step: number) => {
    for (let line = 0; line < size; line++) {
      const base = line * stride
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[base + Math.min(size - 1, Math.max(0, k)) * step]
      for (let n = 0; n < size; n++) {
        dst[base + n * step] = sum / (2 * r + 1)
        sum += src[base + Math.min(size - 1, n + r + 1) * step] - src[base + Math.max(0, n - r) * step]
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    pass(grid, tmp, size, 1)
    pass(tmp, grid, 1, size)
  }
}
