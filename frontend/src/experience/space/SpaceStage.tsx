import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three'
import { clamp, lerp, smoothstep } from '../../lib/math'
import type { BakedTextures } from '../bake/bakePlanet'
import { director } from '../director/director'
import { ENTRY } from '../director/FilmDirector'
import { frameState, type ScreenPoint } from '../director/frameState'
import { FRAME_PRIORITY } from '../framePriority'
import { buildCockpit } from './cockpit/buildCockpit'
import { drawCockpitScreens } from './cockpit/cockpitScreens'
import { Planet, type PlanetUniforms } from './Planet'
import { CITY_ON_PLANET, frameCockpit, PLANET_ENTRY_POSITION, PLANET_RADIUS, SUN_DIRECTION } from './spaceConfig'
import { Starfield, type StarUniforms } from './Starfield'
import { Sun } from './Sun'

const SCREEN_REFRESH = 0.12
const APPROACH_SECONDS = 120

/** Act I: the cockpit in orbit, Terra Nova filling the canopy, then the atmospheric entry. */
export function SpaceStage({ textures, light }: { textures: BakedTextures; light: boolean }) {
  const size = useThree((s) => s.size)
  const rootRef = useRef<Group>(null)
  const cameraRef = useRef<PerspectiveCamera>(null)
  const planetRef = useRef<Group>(null)
  const surfaceRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)

  const cockpit = useMemo(() => buildCockpit(), [])
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
    () => ({ planetRest: frameCockpit(16 / 9).planet, screenClock: 0, point: new Vector3(), probe: new Vector3(), toShip: new Vector3() }),
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
    const framing = frameCockpit(aspect)
    camera.aspect = aspect
    camera.fov = framing.fov
    camera.updateProjectionMatrix()
    cockpit.group.scale.x = clamp(aspect / 1.6, 0.36, 1.12)
    state.planetRest = framing.planet
  }, [size, cockpit, state])

  useFrame(({ gl, size: view }) => {
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
    const entry = director.entry
    const e = entry ? entry.t : 0
    const rush = entry ? Math.pow(smoothstep(0.5, 4.5, e), 2.3) : 0
    const shake = entry && !reduced ? smoothstep(1, 4, e) : 0
    const plasma = entry ? smoothstep(2.4, 4.3, e) : 0

    director.approach = Math.min(1, director.approach + dt / APPROACH_SECONDS)
    planet.position.lerpVectors(state.planetRest, PLANET_ENTRY_POSITION, rush)
    planet.position.z += director.approach * 1.3 * (1 - rush)
    surface.rotateY(dt * 0.0012)
    clouds.rotateY(dt * 0.0017)

    // slow hand-held sway, parallax with the pointer, shake during the entry
    const sway = reduced ? 0 : 1
    const { x: px, y: py } = director.pointerSmooth
    camera.rotation.set(
      Math.sin(time * 0.23) * 0.005 * sway - py * 0.012 + (Math.random() - 0.5) * 0.022 * shake,
      Math.sin(time * 0.17) * 0.007 * sway - px * 0.02 + (Math.random() - 0.5) * 0.022 * shake,
      Math.sin(time * 0.13) * 0.005 * sway + (Math.random() - 0.5) * 0.014 * shake,
    )
    root.updateMatrixWorld()
    camera.updateMatrixWorld()

    const u = cockpit.uniforms
    u.uSoleilVue.value.copy(SUN_DIRECTION).transformDirection(camera.matrixWorldInverse)
    u.uPlaneteVue.value.copy(planet.position).normalize().transformDirection(camera.matrixWorldInverse)
    u.uPlasma.value = plasma
    u.uTemps.value = time
    planetUniforms.uTemps.value = time
    starUniforms.uTemps.value = time
    starUniforms.uDpr.value = gl.getPixelRatio() * 1.15

    const hud = frameState.cockpit
    hud.distanceKm = Math.round(lerp(2140 - director.approach * 310, 96, rush))
    hud.speedKms = 7.6 + rush * 3.9 + Math.sin(time * 0.9) * 0.02
    state.screenClock += dt
    if (state.screenClock > SCREEN_REFRESH) {
      state.screenClock = 0
      drawCockpitScreens(cockpit.screens, time, { distanceKm: hud.distanceKm, plasma })
    }

    // the city on the planet: the reticle follows it while it faces the ship
    const city = state.point.copy(CITY_ON_PLANET).multiplyScalar(PLANET_RADIUS).applyMatrix4(surface.matrixWorld)
    const facing = state.probe.copy(city).sub(planet.position).normalize().dot(state.toShip.copy(planet.position).negate().normalize())
    city.project(camera)
    toScreen(city, view.width, view.height, hud.city)
    hud.city.visible = facing > 0.25 && !entry
    director.film.center.set(city.x * 0.5 + 0.5, city.y * 0.5 + 0.5)
    cockpit.lens.getWorldPosition(state.probe).project(camera)
    toScreen(state.probe, view.width, view.height, hud.emitter)

    const film = director.film
    film.speedBlur = entry && !reduced ? smoothstep(0.5, 2.6, e) * (1 - smoothstep(4.5, ENTRY.cut, e)) : 0
    film.plasma = plasma * (reduced ? 0.35 : 1)
    film.exposure = 1 + plasma * 0.3
    film.halo = 1
  }, FRAME_PRIORITY.stage)

  return (
    <group ref={rootRef}>
      <Starfield count={light ? 1600 : 3200} uniforms={starUniforms} />
      <Sun />
      <Planet uniforms={planetUniforms} groupRef={planetRef} surfaceRef={surfaceRef} cloudsRef={cloudsRef} />
      <perspectiveCamera ref={cameraRef} fov={55} near={0.02} far={800}>
        <primitive object={cockpit.group} />
      </perspectiveCamera>
    </group>
  )
}

function toScreen(ndc: Vector3, width: number, height: number, out: ScreenPoint) {
  out.x = (ndc.x * 0.5 + 0.5) * width
  out.y = (-ndc.y * 0.5 + 0.5) * height
  out.visible = true
}
