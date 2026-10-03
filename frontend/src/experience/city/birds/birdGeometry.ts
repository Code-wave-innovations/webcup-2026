import { BufferAttribute, InstancedBufferGeometry } from 'three'

/** A cross-section of the wing at `r` from its root: leading edge z > 0 > trailing edge z (the spar runs along z = 0). */
export interface WingStation {
  r: number
  lead: number
  trail: number
}

/** Slotted primaries spreading from the last wing station, as on eagles: the middle ones longest. */
interface Fingers {
  count: number
  length: number
  /** how far apart the finger tips fan, along z */
  spread: number
}

/** A bird for a wingspan of 1: forward along +z, up along +y, wings flat in the y = 0 plane. */
export interface Planform {
  /** half-width of the body where the wings start */
  root: number
  /** shoulder → wrist: beyond it the hand bends and sweeps on its own (see bird.vert) */
  arm: number
  /** from the root (r = 0) to the tip */
  wing: readonly WingStation[]
  fingers?: Fingers
  /** lathe profile of body, neck and head, nose first: [z, radius] */
  body: ReadonlyArray<readonly [number, number]>
  /** body rings ahead of this z take the head colour */
  headFrom: number
  /** tail triangles, as a flat list of (x, z) pairs */
  tail: readonly number[]
}

/** `aPartie.x`: which part of the bird a vertex belongs to (bird.vert bends only the wings). */
export const BIRD_PART = { body: 0, wing: 1, tail: 2, head: 3 } as const

const BODY_SIDES = 8
/** the wings join the body a little above its axis */
const WING_HEIGHT = 0.012

/**
 * The mesh of one bird, shared by every instance of its species. Each vertex carries its part, its share
 * of the half-span and of the local chord (`aPartie`), which the shaders use to bend and colour it.
 */
export function createBirdGeometry(shape: Planform): InstancedBufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const parts: number[] = []
  const vertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number, part: number, span: number, chord: number) => {
    positions.push(x, y, z)
    normals.push(nx, ny, nz)
    parts.push(part, span, chord)
  }
  const last = shape.wing[shape.wing.length - 1]
  const reach = last.r + (shape.fingers?.length ?? 0)

  // wings: a strip between consecutive stations, then the fingers; normals are computed by bird.vert
  const wingPoint = (side: number, r: number, z: number, chord: number) =>
    vertex(side * (shape.root + r), WING_HEIGHT, z, 0, 1, 0, BIRD_PART.wing, r / reach, chord)
  for (const side of [1, -1]) {
    for (let i = 0; i + 1 < shape.wing.length; i++) {
      const a = shape.wing[i]
      const b = shape.wing[i + 1]
      wingPoint(side, a.r, a.lead, 0)
      wingPoint(side, a.r, a.trail, 1)
      wingPoint(side, b.r, b.trail, 1)
      wingPoint(side, a.r, a.lead, 0)
      wingPoint(side, b.r, b.trail, 1)
      wingPoint(side, b.r, b.lead, 0)
    }
    const fingers = shape.fingers
    if (!fingers) continue
    const chord = last.lead - last.trail
    for (let i = 0; i < fingers.count; i++) {
      const top = last.lead - (chord * i) / fingers.count - chord * 0.015
      const bottom = last.lead - (chord * (i + 1)) / fingers.count + chord * 0.015
      const length = fingers.length * (0.72 + 0.28 * Math.sin((Math.PI * (i + 0.5)) / fingers.count))
      const middle = (top + bottom) / 2 + fingers.spread * (0.5 - (i + 0.5) / fingers.count)
      const half = (top - bottom) * 0.32
      const share = (i + 0.5) / fingers.count
      const nearTip = last.r + length * 0.84
      wingPoint(side, last.r, top, share)
      wingPoint(side, last.r, bottom, share)
      wingPoint(side, nearTip, middle - half, share)
      wingPoint(side, last.r, top, share)
      wingPoint(side, nearTip, middle - half, share)
      wingPoint(side, nearTip, middle + half, share)
      wingPoint(side, nearTip, middle + half, share)
      wingPoint(side, nearTip, middle - half, share)
      wingPoint(side, last.r + length, middle, share)
    }
  }

  // body, neck and head: rings of the lathe profile
  const ring = (j: number, k: number) => {
    const [z, radius] = shape.body[j]
    const angle = (k / BODY_SIDES) * Math.PI * 2
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    vertex(radius * c, radius * s, z, c, s, 0, z > shape.headFrom ? BIRD_PART.head : BIRD_PART.body, 0, 0)
  }
  for (let j = 0; j + 1 < shape.body.length; j++) {
    for (let k = 0; k < BODY_SIDES; k++) {
      ring(j, k)
      ring(j + 1, k)
      ring(j + 1, k + 1)
      ring(j, k)
      ring(j + 1, k + 1)
      ring(j, k + 1)
    }
  }

  // tail: flat, its chord share running from its base to its tip
  let front = -Infinity
  let back = Infinity
  for (let i = 1; i < shape.tail.length; i += 2) {
    front = Math.max(front, shape.tail[i])
    back = Math.min(back, shape.tail[i])
  }
  for (let i = 0; i < shape.tail.length; i += 2) {
    const z = shape.tail[i + 1]
    vertex(shape.tail[i], 0, z, 0, 1, 0, BIRD_PART.tail, 0, (front - z) / (front - back))
  }

  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('aPartie', new BufferAttribute(new Float32Array(parts), 3))
  return geometry
}
