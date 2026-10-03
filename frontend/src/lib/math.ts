export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}

/** GLSL smoothstep: 0 below `edge0`, 1 above `edge1`, eased in between (edges may be reversed). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent exponential approach: the share of the remaining distance covered in `dt`. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}
