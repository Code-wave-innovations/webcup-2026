import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { clamp } from '../lib/math'
import { bakePlanet } from './bake/bakePlanet'
import { CityStage } from './city/CityStage'
import { loadCityData } from './city/layout/loadCityData'
import type { CityData } from './city/layout/generateCity'
import { debugParams } from './director/debugParams'
import { director } from './director/director'
import { useDirectorStore } from './director/directorStore'
import { FRAME_PRIORITY } from './framePriority'
import { PostProcessing } from './post/PostProcessing'
import { detectQuality } from './quality/quality'
import { ResolutionGovernor } from './quality/ResolutionGovernor'
import { SpaceStage } from './space/SpaceStage'

/** Everything inside the canvas: both stages stay mounted (compiled once), only the active one is drawn. */
export function Film() {
  const gl = useThree((s) => s.gl)
  const profile = useMemo(() => detectQuality(gl), [gl])
  const textures = useMemo(() => bakePlanet(gl, profile.planetTextureSize), [gl, profile])
  const [cityData, setCityData] = useState<CityData | null>(null)

  useEffect(() => {
    // dev tooling: inspect the film from the browser console or a test driver
    if (import.meta.env.DEV) Object.assign(window, { __nova: { director, profile, gl } })
  }, [profile, gl])

  useEffect(() => {
    let alive = true
    loadCityData(profile.light).then((data) => alive && setCityData(data))
    return () => {
      alive = false
    }
  }, [profile])

  return (
    <>
      <ResolutionGovernor profile={profile} />
      <FrameLoopGovernor />
      <DirectorClock />
      <SpaceStage textures={textures} light={profile.light} />
      {cityData && <CityStage data={cityData} textures={textures} hdr={profile.hdr} />}
      <PostProcessing profile={profile} camera={activeCamera} controls={director.film} frameTime={filmTime} />
      {cityData && <StartWhenCompiled />}
    </>
  )
}

const activeCamera = () => director.cameras[director.stage]
const filmTime = () => ({ dt: director.dt, time: director.time })

const CONSOLE_SETTLE_MS = 1600

/**
 * While a console page covers the city, the scene stops redrawing once the camera has reached its pose
 * (R3F then renders only on resize). The film resumes where it was when the console closes.
 */
function FrameLoopGovernor() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const consoleOpen = useDirectorStore((s) => s.console)

  useEffect(() => {
    if (!consoleOpen) {
      setFrameloop('always')
      return
    }
    const timer = setTimeout(() => setFrameloop('demand'), director.reducedMotion ? 0 : CONSOLE_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [consoleOpen, setFrameloop])

  return null
}

/** Advances the film once per frame, with a clamped step so a stalled tab does not skip the entry. */
function DirectorClock() {
  useFrame((_, delta) => {
    if (useDirectorStore.getState().status !== 'ready') return
    director.tick(clamp(delta, 0, debugParams.fastClock ? 0.6 : 0.05))
  }, FRAME_PRIORITY.director)
  return null
}

/** Compiles every shader of both stages while the loading screen is still up, then rolls the film. */
function StartWhenCompiled() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const store = useDirectorStore.getState()
    if (store.status === 'ready') return
    for (const camera of [director.cameras.space, director.cameras.city]) {
      if (camera) gl.compile(scene, camera)
    }
    director.start()
    store.setStatus('ready')
  }, [gl, scene])

  return null
}
