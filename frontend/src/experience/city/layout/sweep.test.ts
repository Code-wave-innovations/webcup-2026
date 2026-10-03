import { CatmullRomCurve3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { circleCurve, deckProfile, sweepProfile } from './sweep'

const faces = (geometry: ReturnType<typeof sweepProfile>) => {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()!
  const out: Array<{ face: Vector3; normal: Vector3; centre: Vector3 }> = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    const centre = a.clone().add(b).add(c).divideScalar(3)
    const face = b.clone().sub(a).cross(c.clone().sub(a))
    if (face.lengthSq() < 1e-12) continue
    out.push({ face: face.normalize(), normal: new Vector3().fromBufferAttribute(normal, index.getX(i)), centre })
  }
  return out
}

describe('sweepProfile', () => {
  const profile = deckProfile(3.1, 0.9, 1.6, false)

  it('winds every triangle along its normal (nothing culled from outside)', () => {
    for (const curve of [circleCurve(0, -4, 35, 3.7), new CatmullRomCurve3([new Vector3(0, 3.7, 31), new Vector3(5, 4.1, 70), new Vector3(-2, 3.3, 114)])]) {
      for (const { face, normal } of faces(sweepProfile(curve, profile, 40))) expect(face.dot(normal)).toBeGreaterThan(0.99)
    }
  })

  it('puts the road on top facing up and the girder underneath facing down', () => {
    const geometry = sweepProfile(circleCurve(0, 0, 20, 4), profile, 24)
    const all = faces(geometry)
    const top = all.filter((f) => Math.abs(f.centre.y - 4) < 1e-4)
    const bottom = all.filter((f) => Math.abs(f.centre.y - (4 - 1.6)) < 1e-4)
    expect(top.length).toBeGreaterThan(0)
    expect(bottom.length).toBeGreaterThan(0)
    top.forEach((f) => expect(f.normal.y).toBeCloseTo(1, 5))
    bottom.forEach((f) => expect(f.normal.y).toBeCloseTo(-1, 5))
  })

  it('labels the carriageway 0 → 1 across and the sidewalks outside it', () => {
    const vs = profile.map((p) => p.v)
    expect(Math.min(...vs.filter((v) => v < 1.5))).toBeLessThan(0)
    expect(profile.find((p) => p.v === 0)!.b).toBeCloseTo(-3.1)
    expect(profile.find((p) => p.v === 1)!.b).toBeCloseTo(3.1)
  })
})
