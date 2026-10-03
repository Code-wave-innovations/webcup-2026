import { Vector3 } from 'three'
import { clamp } from '../../../lib/math'

const scratch = new Vector3()

/**
 * An authored polyline resampled by arc length: vehicles and walkers call `sample` / `tangent`
 * each frame. Closed loops wrap; open ones clamp (the walker turns around).
 */
export class GroundPath {
  readonly length: number
  readonly closed: boolean
  private readonly points: Float32Array
  private readonly distances: Float32Array
  private readonly count: number

  constructor(points: readonly Vector3[], closed: boolean) {
    if (points.length < 2) throw new Error('GroundPath needs at least two points')
    this.closed = closed
    const n = points.length
    const extra = closed ? 1 : 0
    const packed = new Float32Array((n + extra) * 3)
    for (let i = 0; i < n; i++) {
      packed[i * 3] = points[i].x
      packed[i * 3 + 1] = points[i].y
      packed[i * 3 + 2] = points[i].z
    }
    if (closed) packed.copyWithin(n * 3, 0, 3)
    const distances = new Float32Array(n + extra)
    for (let i = 1; i < n + extra; i++) {
      const dx = packed[i * 3] - packed[i * 3 - 3]
      const dy = packed[i * 3 + 1] - packed[i * 3 - 2]
      const dz = packed[i * 3 + 2] - packed[i * 3 - 1]
      distances[i] = distances[i - 1] + Math.hypot(dx, dy, dz)
    }
    this.points = packed
    this.distances = distances
    this.count = n + extra
    this.length = Math.max(distances[n + extra - 1], 1e-4)
  }

  /** Point `distance` along the path (wraps when closed, clamps when open). */
  sample(distance: number, out: Vector3): Vector3 {
    return this.at(this.locate(distance), out)
  }

  /** Unit tangent at `distance` (from a short finite difference). */
  tangent(distance: number, out: Vector3): Vector3 {
    const step = Math.min(0.4, this.length * 0.02)
    this.sample(distance + step, out)
    this.sample(distance - step, scratch)
    out.sub(scratch)
    const len = out.length()
    return len > 1e-6 ? out.multiplyScalar(1 / len) : out.set(0, 0, 1)
  }

  /** Keeps an open-path cursor on the segment; returns the reversed speed when it hits an end. */
  advance(distance: number, speed: number, dt: number): { distance: number; speed: number } {
    let next = distance + speed * dt
    if (this.closed) {
      next = ((next % this.length) + this.length) % this.length
      return { distance: next, speed }
    }
    if (next < 0 || next > this.length) {
      speed = -speed
      next = clamp(next, 0, this.length)
    }
    return { distance: next, speed }
  }

  private locate(distance: number): number {
    const d = this.closed ? ((distance % this.length) + this.length) % this.length : clamp(distance, 0, this.length)
    const last = this.count - 1
    let low = 0
    let high = last
    while (high - low > 1) {
      const mid = (low + high) >> 1
      if (this.distances[mid] <= d) low = mid
      else high = mid
    }
    const span = this.distances[high] - this.distances[low]
    return low + (span > 1e-6 ? (d - this.distances[low]) / span : 0)
  }

  private at(index: number, out: Vector3): Vector3 {
    const i = Math.floor(index)
    const t = index - i
    const p = this.points
    return out.set(
      p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * t,
      p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * t,
      p[i * 3 + 2] + (p[i * 3 + 5] - p[i * 3 + 2]) * t,
    )
  }
}
