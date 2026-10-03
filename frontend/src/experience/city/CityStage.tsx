import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { PerspectiveCamera, Vector2, Vector3, type Group, type Mesh } from 'three'
import { damp, lerp, smoothstep } from '../../lib/math'
import { matchesQuery, PHONE_QUERY } from '../../hooks/useMediaQuery'
import type { BakedTextures } from '../bake/bakePlanet'
import { debugParams } from '../director/debugParams'
import { director } from '../director/director'
import { useDirectorStore } from '../director/directorStore'
import { frameState, type AnchorId } from '../director/frameState'
import { FRAME_PRIORITY } from '../framePriority'
import { createPathSample, sampleCameraPath } from './cameraPath'
import { COUNCIL_TOWER, DOME_BASE, DOME_FLATTEN, DOMES, SUN_AZIMUTH } from './cityConfig'
import { CityContext, type CityContextValue } from './CityContext'
import type { CityData } from './layout/generateCity'
import { AlertSpotlights, SignalBeam } from './parts/Beams'
import { Beacons } from './parts/Beacons'
import { Domes } from './parts/Domes'
import { Roads } from './parts/Roads'
import { Shuttles } from './parts/Shuttles'
import { Sky } from './parts/Sky'
import { Terrain } from './parts/Terrain'
import { Towers } from './parts/Towers'
import { Water } from './parts/Water'
import { createWorldMaterial, createWorldUniforms } from './worldMaterial'
import towerVert from './glsl/tower.vert.glsl?raw'
import towerFrag from './glsl/tower.frag.glsl?raw'

interface CityStageProps {
  data: CityData
  textures: BakedTextures
  hdr: boolean
}

const domeTop = (id: string) => {
  const dome = DOMES.find((d) => d.id === id)!
  return new Vector3(dome.x, DOME_BASE + dome.r * DOME_FLATTEN, dome.z)
}

/** Landmarks the interface links its panels to. */
const ANCHORS: Record<AnchorId, Vector3> = {
  central: domeTop('central'),
  serre: domeTop('serre'),
  trois: domeTop('trois'),
  conseil: new Vector3(COUNCIL_TOWER.x, 0.5 + COUNCIL_TOWER.h * 0.86, COUNCIL_TOWER.z),
  pont: new Vector3(4, 4.4, 60),
}

/** Where the descent starts: high in the atmosphere, above and behind the lake. */
const DESCENT_FROM = new Vector3(-80, 230, 350)
const DESCENT_LOOK = new Vector3(0, -40, 10)

/** Acts III and IV: the city at sunset, flown over as the page scrolls, night falling section after section. */
export function CityStage({ data, textures, hdr }: CityStageProps) {
  const rootRef = useRef<Group>(null)
  const skyRef = useRef<Mesh>(null)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  const city = useMemo<CityContextValue>(
    () => ({ data, textures, uniforms: createWorldUniforms(), pointScale: { value: 1 }, hdr }),
    [data, textures, hdr],
  )
  const towerMaterial = useMemo(() => createWorldMaterial(city.uniforms, towerVert, towerFrag), [city])
  const cameras = useMemo(() => ({ main: new PerspectiveCamera(40, 1, 0.4, 4000), mirror: new PerspectiveCamera(40, 1, 0.4, 4000) }), [])
  const alertLevel = useMemo(() => ({ value: 0 }), [])
  const scratch = useMemo(
    () => ({ path: createPathSample(), position: new Vector3(), target: new Vector3(), point: new Vector3(), buffer: new Vector2() }),
    [],
  )

  useLayoutEffect(() => {
    director.cameras.city = cameras.main
    return () => {
      director.cameras.city = null
    }
  }, [cameras])

  useEffect(() => {
    const aspect = size.width / size.height
    cameras.main.aspect = cameras.mirror.aspect = aspect
  }, [size, cameras])

  useFrame(() => {
    const root = rootRef.current
    if (!root) return
    root.visible = director.stage === 'city'
    if (!root.visible) return

    const { dt, time, reducedMotion: reduced, arrival } = director
    const { uniforms } = city
    const camera = cameras.main
    const phone = matchesQuery(PHONE_QUERY)

    director.scrollSmooth += (director.scrollTarget - director.scrollSmooth) * (reduced || debugParams.instantCamera ? 1 : damp(3.4, dt))
    const pose = sampleCameraPath(director.scrollSmooth, scratch.path)
    const hour = debugParams.hour ?? pose.hour
    const position = scratch.position.fromArray(pose.position)
    const target = scratch.target.fromArray(pose.target)

    // descent from the upper atmosphere, shaking until the air thickens
    if (arrival < 1) {
      const eased = 1 - Math.pow(1 - arrival, 3)
      position.lerpVectors(DESCENT_FROM, position, eased)
      target.lerpVectors(DESCENT_LOOK, target, eased)
      if (!reduced) {
        position.x += (Math.random() - 0.5) * 2.4 * (1 - eased)
        position.y += (Math.random() - 0.5) * 2.4 * (1 - eased)
      }
    }
    if (!reduced) {
      position.x += Math.sin(time * 0.21) * 0.22 + director.pointerSmooth.x * 1.3
      position.y += Math.sin(time * 0.27 + 1.3) * 0.16 - director.pointerSmooth.y * 0.6
    }

    // keep the horizontal field of view on narrow screens; frame the subject opposite the text column
    gl.getDrawingBufferSize(scratch.buffer)
    const { x: width, y: height } = scratch.buffer
    const tanHalf = Math.tan((pose.focal * Math.PI) / 360)
    const fov = (2 * Math.atan(Math.max(tanHalf, (tanHalf * 0.99) / camera.aspect)) * 180) / Math.PI
    const portrait = width / height < 0.8
    const offsetX = Math.round((portrait || phone ? 0 : -pose.side * 0.17) * width)
    const offsetY = Math.round((phone ? 0.16 : 0) * height * arrival)
    camera.position.copy(position)
    camera.fov = fov
    camera.setViewOffset(width, height, offsetX, offsetY, width, height)
    camera.lookAt(target)
    camera.updateMatrixWorld()

    // the sun goes down as the visitor scrolls
    const elevation = ((6.5 - 17 * hour) * Math.PI) / 180
    uniforms.uSoleil.value.set(SUN_AZIMUTH.x * Math.cos(elevation), Math.sin(elevation), SUN_AZIMUTH.z * Math.cos(elevation))
    uniforms.uHeure.value = smoothstep(0.2, 1, hour)
    uniforms.uNuit.value = smoothstep(0.26, 0.92, hour)
    uniforms.uTemps.value = time
    frameState.dusk = hour
    alertLevel.value += ((useDirectorStore.getState().alert ? 1 : 0) - alertLevel.value) * Math.min(1, dt * 3)
    uniforms.uAlerte.value = alertLevel.value
    uniforms.uOmbreY.value = Math.max(0, 170 * (data.horizonAtCenter - Math.tan(elevation)))
    uniforms.uBrume.value = 0.0016 + Math.pow(1 - arrival, 2) * 0.06
    city.pointScale.value = height / (2 * Math.tan((fov * Math.PI) / 360))

    // the mirror camera, for the lake's reflection
    const mirror = cameras.mirror
    mirror.fov = fov
    mirror.setViewOffset(width, height, offsetX, -offsetY, width, height)
    mirror.position.set(position.x, -position.y, position.z)
    mirror.up.set(0, 1, 0)
    mirror.lookAt(target.x, -target.y, target.z)
    mirror.updateMatrixWorld()
    skyRef.current?.position.copy(camera.position)

    for (const id of Object.keys(ANCHORS) as AnchorId[]) {
      const p = scratch.point.copy(ANCHORS[id]).project(camera)
      const anchor = frameState.anchors[id]
      anchor.x = (p.x * 0.5 + 0.5) * size.width
      anchor.y = (-p.y * 0.5 + 0.5) * size.height
      anchor.visible = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05
    }

    const film = director.film
    film.speedBlur = 0
    film.plasma = 0
    film.exposure = lerp(0.95, 1.3, uniforms.uNuit.value) * (1 + (1 - arrival) * 0.5)
    film.halo = 1
  }, FRAME_PRIORITY.stage)

  return (
    <CityContext.Provider value={city}>
      <group ref={rootRef} visible={false}>
        <primitive object={cameras.main} />
        <Sky meshRef={skyRef} />
        <Terrain />
        <Water mirrorCamera={cameras.mirror} sky={skyRef} />
        <Towers material={towerMaterial} />
        <Domes plinthMaterial={towerMaterial} />
        <Roads />
        <Beacons />
        <Shuttles />
        <SignalBeam />
        <AlertSpotlights alertLevel={alertLevel} />
      </group>
    </CityContext.Provider>
  )
}
