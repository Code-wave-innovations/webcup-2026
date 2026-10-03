import { BufferAttribute, BufferGeometry, Vector3 } from 'three'

/** What a sweep needs from a path: a point and a unit tangent at t ∈ [0, 1], and its length. */
export interface SweepCurve {
  getPoint(t: number, out?: Vector3): Vector3
  getTangent(t: number, out?: Vector3): Vector3
  getLength(): number
}

/**
 * One corner of a cross-section, in the path's frame: `b` across (positive on the right of the travel direction),
 * `y` up from the path, and `v` the texture coordinate the shader reads to tell the surfaces apart.
 */
export interface ProfilePoint {
  b: number
  y: number
  v: number
}

const UP = new Vector3(0, 1, 0)

/** A horizontal circle as a sweep path (the ring road), starting on +x and turning towards +z. */
export function circleCurve(cx: number, cz: number, radius: number, y: number): SweepCurve {
  return {
    getPoint: (t, out = new Vector3()) => out.set(cx + Math.cos(t * Math.PI * 2) * radius, y, cz + Math.sin(t * Math.PI * 2) * radius),
    getTangent: (t, out = new Vector3()) => out.set(-Math.sin(t * Math.PI * 2), 0, Math.cos(t * Math.PI * 2)),
    getLength: () => 2 * Math.PI * radius,
  }
}

/** Right-hand horizontal direction across a path whose tangent is `tangent` (y up). */
export function acrossOf(tangent: Vector3, out: Vector3): Vector3 {
  return out.crossVectors(tangent, UP).normalize()
}

/**
 * Extrudes a closed cross-section along a path. Every face of the section gets its own vertices, so edges stay
 * crisp (flat normals across the section, smooth along the path). `uv.x` is the share of the path's length,
 * `uv.y` the profile's `v`, interpolated along each edge. The section is rebuilt in the path's frame at every
 * step: across = tangent × up, so it stays level on slopes and banks with nothing.
 */
export function sweepProfile(curve: SweepCurve, profile: readonly ProfilePoint[], segments: number): BufferGeometry {
  const edges = profile.length
  // signed area of the section: tells which side of each edge is outside
  let area = 0
  for (let i = 0; i < edges; i++) {
    const p = profile[i]
    const q = profile[(i + 1) % edges]
    area += p.b * q.y - q.b * p.y
  }
  const outward = area > 0 ? 1 : -1

  const rings = segments + 1
  const vertexCount = edges * 2 * rings
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const point = new Vector3()
  const tangent = new Vector3()
  const across = new Vector3()

  for (let k = 0; k < rings; k++) {
    const t = k / segments
    curve.getPoint(t, point)
    acrossOf(curve.getTangent(t, tangent).normalize(), across)
    for (let e = 0; e < edges; e++) {
      const p = profile[e]
      const q = profile[(e + 1) % edges]
      const db = q.b - p.b
      const dy = q.y - p.y
      const len = Math.hypot(db, dy) || 1
      const nb = (outward * dy) / len
      const ny = (-outward * db) / len
      for (let s = 0; s < 2; s++) {
        const c = s === 0 ? p : q
        const index = (k * edges + e) * 2 + s
        positions[index * 3] = point.x + across.x * c.b
        positions[index * 3 + 1] = point.y + c.y
        positions[index * 3 + 2] = point.z + across.z * c.b
        normals[index * 3] = across.x * nb
        normals[index * 3 + 1] = ny
        normals[index * 3 + 2] = across.z * nb
        uvs[index * 2] = t
        uvs[index * 2 + 1] = c.v
      }
    }
  }

  // two triangles per edge and step, wound so that their face points along the edge's outward normal
  const indices: number[] = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let e = 0; e < edges; e++) {
    const at = (k: number, s: number) => (k * edges + e) * 2 + s
    a.fromArray(positions, at(0, 0) * 3)
    b.fromArray(positions, at(1, 0) * 3)
    c.fromArray(positions, at(1, 1) * 3)
    const face = b.sub(a).cross(c.sub(a))
    const expected = new Vector3().fromArray(normals, at(0, 0) * 3)
    const flip = face.dot(expected) < 0
    for (let k = 0; k < segments; k++) {
      const p0 = at(k, 0)
      const p1 = at(k, 1)
      const n0 = at(k + 1, 0)
      const n1 = at(k + 1, 1)
      if (flip) indices.push(p0, n1, n0, p0, p1, n1)
      else indices.push(p0, n0, n1, p0, n1, p1)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Cross-section of a road deck, its road surface at y = 0: the carriageway (v 0 → 1), raised sidewalks with their
 * curbs (v < 0 and 1 < v < 1.5), the fascia where the light strip runs (v 2 → 2.6), then a box girder tapering
 * underneath (v ≥ 2.6). With `parapet`, low concrete walls close the edges (the ring road's viaduct).
 */
export function deckProfile(roadHalf: number, sidewalk: number, depth: number, parapet: boolean): ProfilePoint[] {
  const curb = 0.18
  const edge = roadHalf + sidewalk
  const fascia = edge + 0.15
  const soffit = roadHalf * 0.82
  const right: ProfilePoint[] = [
    { b: roadHalf, y: 0, v: 1 },
    { b: roadHalf, y: curb, v: 1.05 },
    ...(parapet
      ? [
          { b: edge - 0.22, y: curb, v: 1.2 },
          { b: edge - 0.22, y: 0.78, v: 1.3 },
          { b: edge, y: 0.82, v: 1.4 },
          { b: fascia, y: 0.05, v: 2.0 },
        ]
      : [
          { b: edge, y: curb, v: 1.2 },
          { b: fascia, y: 0.05, v: 2.0 },
        ]),
    { b: fascia, y: -depth * 0.35, v: 2.6 },
    { b: soffit, y: -depth, v: 4 },
  ]
  // the left half mirrors the right one, walked backwards so the outline stays a simple loop
  const left = right
    .slice()
    .reverse()
    .map((p) => ({ b: -p.b, y: p.y, v: p.v === 1 ? 0 : p.v > 1 && p.v < 1.5 ? -(p.v - 1) : p.v }))
  return [{ b: -roadHalf, y: 0, v: 0 }, ...right, ...left.slice(0, -1)]
}
