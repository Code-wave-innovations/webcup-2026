import type { Vector3 } from 'three'
import { COUNCIL_TOWER, DOMES, OBSERVATORY, type POI, type PoiId } from '../cityConfig'
import { LOW_RISE_STRIDE, type CityData } from '../layout/generateCity'
import { relief } from '../layout/relief'

const WATER = 0.45
/** share of a site's radius that can be walked (its edge blends into the countryside) */
const SITE_WALK = 0.92
/** a building this close to the flight corridor counts in the skyline */
const SKYLINE_MARGIN = 4

/** A building or wall of a site (a house, the clubhouse, a stand): Nova walks around it, the camera stays out of it. */
export interface SiteObstacle {
  x: number
  z: number
  halfX: number
  halfZ: number
  rotation: number
  /** roof height above sea level */
  top: number
}

/** each site's part registers its buildings when it is built */
const siteObstacles = new Map<PoiId, readonly SiteObstacle[]>()

export function setSiteObstacles(site: PoiId, obstacles: readonly SiteObstacle[]): void {
  siteObstacles.set(site, obstacles)
}

/** walkers keep this far from a site's walls */
const WALL_MARGIN = 0.35

function insideObstacle(o: SiteObstacle, x: number, z: number, margin: number): boolean {
  const dx = x - o.x
  const dz = z - o.z
  const c = Math.cos(o.rotation)
  const s = Math.sin(o.rotation)
  return Math.abs(dx * c - dz * s) < o.halfX + margin && Math.abs(dx * s + dz * c) < o.halfZ + margin
}

/**
 * Share (0 → 1) of the segment from `from` (Nova's head) to `to` (the camera) that is clear of the site's buildings
 * and of the ground: the camera's boom is shortened to it so the camera never ends up inside a wall or a slope.
 */
export function boomClearance(from: Vector3, to: Vector3, site: PoiId | null): number {
  const obstacles = site ? (siteObstacles.get(site) ?? []) : []
  const steps = 20
  for (let k = 1; k <= steps; k++) {
    const f = k / steps
    const x = from.x + (to.x - from.x) * f
    const y = from.y + (to.y - from.y) * f
    const z = from.z + (to.z - from.z) * f
    if (y < ground(x, z) + 0.4) return (k - 1) / steps
    for (const o of obstacles) {
      if (y < o.top + 0.3 && insideObstacle(o, x, z, 0.3)) return (k - 1) / steps
    }
  }
  return 1
}

export interface ExploreHit {
  x: number
  z: number
  y: number
  blocked: boolean
}

interface Disc {
  x: number
  z: number
  r: number
}

interface Top extends Disc {
  /** roof height above sea level */
  y: number
}

interface Box {
  x: number
  z: number
  halfX: number
  halfZ: number
  cos: number
  sin: number
}

/** Where Nova can walk: inside the site it landed on (`null`: anywhere dry), around the buildings. */
export interface ExploreCollision {
  blocked(x: number, z: number, site: POI | null): boolean
  resolve(x: number, z: number, dx: number, dz: number, site: POI | null): ExploreHit
  snap(x: number, z: number, site: POI | null): ExploreHit
  /** height a flight must clear at (x, z): the terrain or the roofs */
  skyline(x: number, z: number): number
}

const ground = (x: number, z: number) => Math.max(relief(x, z), 0)

/** Builds the walkability query from the generated city (towers, domes, low-rise, water) and the skyline over it. */
export function createExploreCollision(data: CityData): ExploreCollision {
  const discs: Disc[] = data.towers.map((t) => ({ x: t.x, z: t.z, r: t.width * 0.52 }))
  DOMES.forEach((d) => discs.push({ x: d.x, z: d.z, r: d.r + 0.45 }))
  discs.push({ x: OBSERVATORY.x, z: OBSERVATORY.z, r: OBSERVATORY.radius + 0.9 })
  discs.push({ x: COUNCIL_TOWER.x, z: COUNCIL_TOWER.z, r: 2.9 })

  const tops: Top[] = data.towers.map((t) => ({ x: t.x, z: t.z, r: t.width * 0.6 + SKYLINE_MARGIN, y: ground(t.x, t.z) + t.height }))
  DOMES.forEach((d) => tops.push({ x: d.x, z: d.z, r: d.r + SKYLINE_MARGIN, y: ground(d.x, d.z) + d.r }))
  tops.push({ x: OBSERVATORY.x, z: OBSERVATORY.z, r: OBSERVATORY.radius + SKYLINE_MARGIN, y: ground(OBSERVATORY.x, OBSERVATORY.z) + OBSERVATORY.h })
  tops.push({ x: COUNCIL_TOWER.x, z: COUNCIL_TOWER.z, r: 3 + SKYLINE_MARGIN, y: ground(COUNCIL_TOWER.x, COUNCIL_TOWER.z) + COUNCIL_TOWER.h })

  const boxes: Box[] = []
  const low = data.lowRise
  for (let i = 0; i < low.length; i += LOW_RISE_STRIDE) {
    const rot = low[i + 6]
    boxes.push({
      x: low[i],
      z: low[i + 2],
      halfX: low[i + 3] * 0.5 + 0.12,
      halfZ: low[i + 4] * 0.5 + 0.12,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
    })
  }

  const blocked = (x: number, z: number, site: POI | null): boolean => {
    if (relief(x, z) < WATER) return true
    if (site && Math.hypot(x - site.x, z - site.z) > site.radius * SITE_WALK) return true
    if (site) for (const o of siteObstacles.get(site.id) ?? []) if (insideObstacle(o, x, z, WALL_MARGIN)) return true
    for (const d of discs) {
      if (Math.hypot(x - d.x, z - d.z) < d.r) return true
    }
    for (const b of boxes) {
      const dx = x - b.x
      const dz = z - b.z
      const lx = dx * b.cos + dz * b.sin
      const lz = -dx * b.sin + dz * b.cos
      if (Math.abs(lx) < b.halfX && Math.abs(lz) < b.halfZ) return true
    }
    return false
  }

  const snap = (x: number, z: number, site: POI | null): ExploreHit => {
    if (!blocked(x, z, site)) return { x, z, y: ground(x, z), blocked: false }
    for (let ring = 1; ring <= 8; ring++) {
      const r = ring * 1.4
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 * k) / 8
        const sx = x + Math.cos(a) * r
        const sz = z + Math.sin(a) * r
        if (!blocked(sx, sz, site)) return { x: sx, z: sz, y: ground(sx, sz), blocked: false }
      }
    }
    return { x, z, y: ground(x, z), blocked: true }
  }

  const resolve = (x: number, z: number, dx: number, dz: number, site: POI | null): ExploreHit => {
    const nx = x + dx
    const nz = z + dz
    if (!blocked(nx, nz, site)) return { x: nx, z: nz, y: ground(nx, nz), blocked: false }
    if (!blocked(x + dx, z, site)) return { x: x + dx, z, y: ground(x + dx, z), blocked: false }
    if (!blocked(x, z + dz, site)) return { x, z: z + dz, y: ground(x, z + dz), blocked: false }
    // along a site's round edge neither axis is free: slide along the tangent
    if (site) {
      const ox = x - site.x
      const oz = z - site.z
      const len = Math.hypot(ox, oz) || 1
      const along = (dx * -oz + dz * ox) / len
      const tx = x + (-oz / len) * along
      const tz = z + (ox / len) * along
      if (!blocked(tx, tz, site)) return { x: tx, z: tz, y: ground(tx, tz), blocked: true }
    }
    return { x, z, y: ground(x, z), blocked: true }
  }

  const skyline = (x: number, z: number): number => {
    let top = ground(x, z)
    for (const t of tops) {
      if (t.y > top && Math.hypot(x - t.x, z - t.z) < t.r) top = t.y
    }
    return top
  }

  return { blocked, resolve, snap, skyline }
}

let installed: ExploreCollision | null = null

export function installExploreCollision(data: CityData): ExploreCollision {
  installed = createExploreCollision(data)
  return installed
}

export function exploreCollision(): ExploreCollision | null {
  return installed
}
