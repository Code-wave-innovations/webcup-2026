import { describe, expect, it } from 'vitest'
import { poiById } from '../city/cityConfig'
import { generateCity } from '../city/layout/generateCity'
import { installExploreCollision } from '../city/explore/exploreCollision'
import type { ExploreStatus } from './directorStore'
import { FilmDirector } from './FilmDirector'

installExploreCollision(generateCity(true))

function run(film: FilmDirector, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) film.tick(1 / 30)
}

function createFilm(reducedMotion: boolean) {
  const statuses: ExploreStatus[] = []
  const film = new FilmDirector(() => {}, reducedMotion, (status) => statuses.push(status))
  film.land(2)
  return { film, statuses }
}

describe('FilmDirector explore', () => {
  it('flies Nova from the flyover to the golf course, then lets it walk there', () => {
    const { film, statuses } = createFilm(false)
    film.enterExplore()
    expect(film.phase).toBe('explore')
    expect(film.flight?.destination).toBe('golf')
    expect(film.site).toBeNull()

    const phases = new Set<string>()
    for (let t = 0; t < 20 && film.flying; t += 1 / 30) {
      film.tick(1 / 30)
      if (film.flight) phases.add(film.flight.phase)
    }
    expect([...phases]).toEqual(['crouch', 'takeoff', 'cruise', 'flare', 'landing'])
    expect(film.site).toBe('golf')
    const golf = poiById('golf')
    expect(Math.hypot(film.roam.nova.x - golf.x, film.roam.nova.z - golf.z)).toBeLessThan(golf.radius)
    expect(statuses.at(-1)).toMatchObject({ site: 'golf', flight: null, leaving: false })
    expect(film.exploreBlend).toBe(1)

    // walking forward moves Nova, the camera follows it
    const before = { x: film.roam.nova.x, z: film.roam.nova.z }
    film.roam.move.z = 1
    run(film, 1)
    film.roam.move.z = 0
    expect(Math.hypot(film.roam.nova.x - before.x, film.roam.nova.z - before.z)).toBeGreaterThan(2)
    expect(film.exploreCamera.view.position.distanceTo(film.exploreCamera.view.target)).toBeLessThan(12)
  })

  it('flies from one site to another', () => {
    const { film } = createFilm(false)
    film.enterExplore()
    run(film, 20)
    film.flyTo('stade')
    expect(film.flight?.destination).toBe('stade')
    run(film, 20)
    expect(film.site).toBe('stade')
  })

  it('takes off to the sky, then glides back to the flyover where it left', () => {
    const { film, statuses } = createFilm(false)
    film.enterExplore()
    run(film, 20)
    film.exitExplore()
    expect(film.flight?.destination).toBeNull()
    expect(statuses.at(-1)?.leaving).toBe(true)
    run(film, 8)
    expect(film.phase).toBe('city')
    expect(film.flying).toBe(false)
    expect(film.exploreBlend).toBe(0)
    expect(film.scrollTarget).toBe(2)
    expect(statuses.at(-1)).toMatchObject({ site: null, flight: null, leaving: false })
  })

  it('with reduced motion, puts Nova straight on the golf course and back', () => {
    const { film } = createFilm(true)
    film.enterExplore()
    expect(film.flying).toBe(false)
    expect(film.site).toBe('golf')
    film.flyTo('village-nord')
    expect(film.site).toBe('village-nord')
    film.exitExplore()
    expect(film.phase).toBe('city')
  })

  it('ignores explore before the city has arrived', () => {
    const film = new FilmDirector(() => {}, true)
    film.enterExplore()
    expect(film.phase).toBe('approach')
    expect(film.exploring).toBe(false)
  })
})
