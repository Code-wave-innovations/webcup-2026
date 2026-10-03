import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { GroundPath } from './groundPath'

describe('GroundPath', () => {
  it('samples a closed square by arc length and wraps', () => {
    const path = new GroundPath([new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(10, 0, 10), new Vector3(0, 0, 10)], true)
    expect(path.length).toBeCloseTo(40, 5)
    const p = new Vector3()
    path.sample(5, p)
    expect(p.x).toBeCloseTo(5)
    expect(p.z).toBeCloseTo(0)
    path.sample(45, p)
    expect(p.x).toBeCloseTo(5)
    expect(p.z).toBeCloseTo(0)
  })

  it('turns an open walker around at the ends', () => {
    const path = new GroundPath([new Vector3(0, 0, 0), new Vector3(4, 0, 0)], false)
    const hit = path.advance(3.9, 2, 0.2)
    expect(hit.speed).toBeLessThan(0)
    expect(hit.distance).toBeCloseTo(4)
  })
})
