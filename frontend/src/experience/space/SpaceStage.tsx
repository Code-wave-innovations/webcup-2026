import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three'
import type { BakedTextures } from '../bake/bakePlanet'
import { director } from '../director/director'
import { FRAME_PRIORITY } from '../framePriority'
import { Planet, type PlanetUniforms } from './Planet'
import { CITY_ON_PLANET, frameOrbit, PLANET_ENTRY_POSITION, PLANET_RADIUS, SUN_DIRECTION } from './spaceConfig'
import { Starfield, type StarUniforms } from './Starfield'
import { Sun } from './Sun'

const APPROACH_SECONDS = 120

/** Act I: Terra Nova seen from orbit, nothing between it and the visitor, then the atmospheric entry. */
export function SpaceStage({ textures, light }: { textures: BakedTextures; light: boolean }) {
  const size = useThree((s) => s.size)
  const rootRef = useRef<Group>(null)
  const cameraRef = useRef<PerspectiveCamera>(null)
  const planetRef = useRef<Group>(null)
  const surfaceRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)

  const starUniforms = useMemo<StarUniforms>(() => ({ uTemps: { value: 0 }, uDpr: { value: 1 } }), [])
  const planetUniforms = useMemo<PlanetUniforms>(
    () => ({
      tSol: { value: textures.soil },
      tRelief: { value: textures.relief },
      uSoleilE: { value: SUN_DIRECTION },
      uTemps: { value: 0 },
      uAlerte: { value: 0 },
    }),
    [textures],
  )
  const state = useMemo(
    () => ({ planetRest: frameOrbit(16 / 9).planet, point: new Vector3() }),
    [],
  )

  useLayoutEffect(() => {
    director.cameras.space = cameraRef.current
    return () => {
      director.cameras.space = null
    }
  }, [])

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return
    const aspect = size.width / size.height
    const framing = frameOrbit(aspect)
    camera.aspect = aspect
    camera.fov = framing.fov
    camera.updateProjectionMatrix()
    state.planetRest = framing.planet
  }, [size, state])

  useFrame(({ gl }) => {
    const root = rootRef.current
    const camera = cameraRef.current
    const planet = planetRef.current
    const surface = surfaceRef.current
    const clouds = cloudsRef.current
    if (!root || !camera || !planet || !surface || !clouds) return
    root.visible = director.stage === 'space'
    if (!root.visible) return

    const dt = director.dt
    const time = director.time
    const reduced = director.reducedMotion
    // the atmospheric entry's timeline drives the dive, the shake and the plasma
    const { rush, shake, plasma, speedBlur } = director.cues

    director.approach = Math.min(1, director.approach + dt / APPROACH_SECONDS)
    planet.position.lerpVectors(state.planetRest, PLANET_ENTRY_POSITION, rush)
    planet.position.z += director.approach * 1.3 * (1 - rush)
    // the clouds turn with the ground and drift across it in their shader (their shadows stay under them)
    surface.rotateY(dt * 0.0012)
    clouds.rotateY(dt * 0.0012)

    // a slow orbital drift, parallax with the pointer, shake during the entry
    const sway = reduced ? 0 : 1
    const { x: px, y: py } = director.pointerSmooth
    camera.rotation.set(
      Math.sin(time * 0.23) * 0.005 * sway - py * 0.012 + (Math.random() - 0.5) * 0.022 * shake,
      Math.sin(time * 0.17) * 0.007 * sway - px * 0.02 + (Math.random() - 0.5) * 0.022 * shake,
      Math.sin(time * 0.13) * 0.005 * sway + (Math.random() - 0.5) * 0.014 * shake,
    )
    root.updateMatrixWorld()
    camera.updateMatrixWorld()

    planetUniforms.uTemps.value = time
    starUniforms.uTemps.value = time
    starUniforms.uDpr.value = gl.getPixelRatio() * 1.15

    // the entry's speed blur streams out of the city on the planet
    const city = state.point.copy(CITY_ON_PLANET).multiplyScalar(PLANET_RADIUS).applyMatrix4(surface.matrixWorld).project(camera)
    director.film.center.set(city.x * 0.5 + 0.5, city.y * 0.5 + 0.5)

    const film = director.film
    film.speedBlur = speedBlur
    film.plasma = plasma
    film.exposure = 1 + plasma * 0.3
    film.halo = 1
    film.rays = 0
  }, FRAME_PRIORITY.stage)

  return (
    <group ref={rootRef}>
      <Starfield count={light ? 1600 : 3200} uniforms={starUniforms} />
      <Sun />
      <Planet uniforms={planetUniforms} groupRef={planetRef} surfaceRef={surfaceRef} cloudsRef={cloudsRef} />
      <perspectiveCamera ref={cameraRef} fov={55} near={0.02} far={800} />
    </group>
  )
}
