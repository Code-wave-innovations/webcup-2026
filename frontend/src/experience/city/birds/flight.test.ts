import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CITY_CENTER, COUNCIL_TOWER } from '../cityConfig'
import type { Tower } from '../layout/generateCity'
import { relief } from '../layout/relief'
import { createAviary, type Aviary } from './flight'

const TOWERS: Tower[] = [
  { x: COUNCIL_TOWER.x, z: COUNCIL_TOWER.z, width: 5.4, height: COUNCIL_TOWER.h, seed: 0.37, kind: 0 },
  { x: 8, z: -18, width: 3, height: 40, seed: 0.5, kind: 1 },
  { x: -16, z: 2, width: 2.5, height: 22, seed: 0.8, kind: 2 },
]
const FRAME = 1 / 60

/** Flies the aviary for `seconds`, calling `check` every half second. */
function fly(aviary: Aviary, seconds: number, check?: () => void): Aviary {
  for (let frame = 1; frame <= seconds / FRAME; frame++) {
    aviary.update(FRAME, frame * FRAME)
    if (check && frame % 30 === 0) check()
  }
  return aviary
}

const allBirds = (aviary: Aviary) => aviary.flocks.flatMap((f) => [...f.birds])

describe('createAviary', () => {
  it('flies the same way on every visit', () => {
    const a = fly(createAviary(TOWERS, false), 12)
    const b = fly(createAviary(TOWERS, false), 12)
    expect(allBirds(a).map((bird) => bird.position.toArray())).toEqual(allBirds(b).map((bird) => bird.position.toArray()))
  })

  it('sends fewer birds on light devices', () => {
    expect(allBirds(createAviary(TOWERS, true)).length).toBeLessThan(allBirds(createAviary(TOWERS, false)).length)
  })

  it('keeps every bird in the air, upright and banking within limits', () => {
    const aviary = createAviary(TOWERS, false)
    fly(aviary, 90, () => {
      for (const bird of allBirds(aviary)) {
        const p = bird.position
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
        expect(p.y).toBeGreaterThan(Math.max(relief(p.x, p.z), 0) + 1)
        expect(bird.forward.length()).toBeCloseTo(1, 3)
        expect(Math.abs(bird.forward.y)).toBeLessThan(0.5)
        expect(Math.abs(bird.bank)).toBeLessThanOrEqual(1.15)
      }
    })
  })

  it('keeps each flock in its part of the sky', () => {
    const aviary = createAviary(TOWERS, false)
    const species = (id: string) => aviary.flocks.filter((f) => f.species === id).flatMap((f) => [...f.birds])
    fly(aviary, 90, () => {
      for (const s of species('swallow')) {
        expect(Math.hypot(s.position.x - CITY_CENTER.x, s.position.z - CITY_CENTER.z)).toBeLessThan(75)
        expect(s.position.y).toBeGreaterThan(6)
        expect(s.position.y).toBeLessThan(45)
      }
      for (const g of species('gull')) expect(Math.hypot((g.position.x - 4) / 46, (g.position.z - 72) / 40)).toBeLessThan(1.4)
    })
  })

  it('sends the swallows where the camera looks, within the city', () => {
    const aviary = createAviary(TOWERS, false)
    const swallows = aviary.flocks.find((f) => f.species === 'swallow')!.birds
    const middle = () => swallows.reduce((sum, b) => sum.add(b.position), new Vector3()).divideScalar(swallows.length)
    aviary.lure(new Vector3(30, 14, 12))
    fly(aviary, 40)
    expect(middle().distanceTo(new Vector3(30, 14, 12))).toBeLessThan(20)
    aviary.lure(new Vector3(0, 60, 400))
    fly(aviary, 60)
    const far = middle()
    expect(Math.hypot(far.x - CITY_CENTER.x, far.z - CITY_CENTER.z)).toBeLessThan(60)
    expect(far.y).toBeLessThan(35)
  })

  it('holds the geese in their V', () => {
    const aviary = createAviary(TOWERS, false)
    const skeins = aviary.flocks.filter((f) => f.species === 'goose')
    expect(skeins.length).toBe(2)
    fly(aviary, 60, () => {
      for (const skein of skeins) {
        const [leader, ...followers] = skein.birds
        followers.forEach((bird, k) => {
          const rank = Math.ceil((k + 1) / 2)
          const gap = bird.position.distanceTo(leader.position)
          expect(gap).toBeGreaterThan(rank * 0.8)
          expect(gap).toBeLessThan(rank * 1.9 + 1)
        })
      }
    })
  })

  it('lets eagles soar and geese row', () => {
    const aviary = createAviary(TOWERS, false)
    const flap = { eagle: 0, goose: 0, samples: 0 }
    fly(aviary, 120, () => {
      flap.samples++
      for (const flock of aviary.flocks) {
        if (flock.species === 'eagle' || flock.species === 'goose') {
          flap[flock.species] += flock.birds.reduce((sum, b) => sum + b.flap, 0) / flock.birds.length
        }
      }
    })
    expect(flap.eagle / flap.samples).toBeLessThan(0.4)
    expect(flap.goose / (2 * flap.samples)).toBeGreaterThan(0.9)
  })
})
