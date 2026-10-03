import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { clamp } from '../lib/math'
import { bakePlanet } from './bake/bakePlanet'
import { CityStage } from './city/CityStage'
import { loadCityData } from './city/layout/loadCityData'
import type { CityData } from './city/layout/generateCity'
import { debugParams } from './director/debugParams'
import { director } from './director/director'
import { useDirectorStore } from './director/directorStore'
import { FRAME_PRIORITY } from './framePriority'
import { NovaActor } from './nova/stage/NovaActor'
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
      <DirectorClock />
      <SpaceStage textures={textures} light={profile.light} />
      {cityData && <CityStage data={cityData} textures={textures} hdr={profile.hdr} light={profile.light} />}
      <PostProcessing profile={profile} camera={activeCamera} controls={director.film} frameTime={filmTime} />
      {/* the film starts once Nova's model is there too (and its shaders compiled with the rest) */}
      <Suspense fallback={null}>
        <NovaActor light={profile.light} />
        {cityData && <StartWhenCompiled />}
      </Suspense>
    </>
  )
}

const activeCamera = () => director.cameras[director.stage]
const filmTime = () => ({ dt: director.dt, time: director.time })

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
