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
import { SUN_AZIMUTH } from './cityConfig'
import { CityContext, type CityContextValue } from './CityContext'
import type { CityData } from './layout/generateCity'
import { AlertSpotlights, SignalBeam } from './parts/Beams'
import { Beacons } from './parts/Beacons'
import { DescentClouds } from './parts/DescentClouds'
import { DistrictMarkers } from './parts/DistrictMarkers'
import { Dust } from './parts/Dust'
import { Greenery } from './parts/Greenery'
import { LowRise } from './parts/LowRise'
import { Observatory } from './parts/Observatory'
import { ANCHORS } from './landmarks'
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
  /** low tier: less dust */
  light: boolean
}

/**
 * The descent: a curved flight from high in the atmosphere, banking out over the lake, then low over the
 * bridge into the arrival framing (cubic Bézier; the last point is the first pose of the flyover).
 */
const DESCENT_FROM = new Vector3(-80, 230, 350)
const DESCENT_C1 = new Vector3(120, 150, 380)
const DESCENT_C2 = new Vector3(70, 34, 250)
const DESCENT_LOOK = new Vector3(0, -40, 10)
/** roll into the turn at its widest, radians */
const DESCENT_BANK = 0.16

/**
 * The Observatory's balcony (the chat page): standing on it, looking over the city at night, the domes below,
 * the lake and the open valley beyond, the subject (Nova) on the left of the frame; the camera arcs up to it from the flyover.
 */
const BALCONY = {
  position: new Vector3(27.6, 36.8, -18.6),
  target: new Vector3(-40, 10, 62),
  focal: 46,
  hour: 1,
  side: -1,
  arc: 14,
}

/** Acts III and IV: the city at sunset, flown over as the page scrolls, night falling section after section. */
export function CityStage({ data, textures, hdr, light }: CityStageProps) {
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
    () => ({ path: createPathSample(), position: new Vector3(), target: new Vector3(), point: new Vector3(), buffer: new Vector2(), sun: new Vector3() }),
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
    const position = scratch.position.fromArray(pose.position)
    const target = scratch.target.fromArray(pose.target)

    // the chat: up to the Observatory's balcony, along an arc, while night falls
    const visit = director.observatory
    if (visit > 0) {
      position.lerp(BALCONY.position, visit)
      position.y += Math.sin(Math.PI * visit) * BALCONY.arc
      target.lerp(BALCONY.target, visit)
      pose.hour = lerp(pose.hour, BALCONY.hour, visit)
      pose.focal = lerp(pose.focal, BALCONY.focal, visit)
      pose.side = lerp(pose.side, BALCONY.side, visit)
    }
    const hour = debugParams.hour ?? pose.hour

    // descent from the upper atmosphere along its curve (`arrival` is already eased), shaking until the air thickens
    let roll = 0
    if (arrival < 1) {
      bezier(DESCENT_FROM, DESCENT_C1, DESCENT_C2, position, arrival, position)
      target.lerpVectors(DESCENT_LOOK, target, smoothstep(0, 0.8, arrival))
      roll = -Math.sin(Math.PI * arrival) * DESCENT_BANK * (1 - arrival)
      if (!reduced) {
        position.x += (Math.random() - 0.5) * 2.4 * (1 - arrival)
        position.y += (Math.random() - 0.5) * 2.4 * (1 - arrival)
      }
    }
    if (!reduced) {
      // hand-held drift and pointer parallax (quieter on the balcony, Nova is close)
      const sway = 1 - visit * 0.75
      position.x += (Math.sin(time * 0.21) * 0.22 + director.pointerSmooth.x * 1.3) * sway
      position.y += (Math.sin(time * 0.27 + 1.3) * 0.16 - director.pointerSmooth.y * 0.6) * sway
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
    camera.rotateZ(roll)
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
    mirror.rotateZ(-roll)
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

    // crepuscular rays while the sun is up and in front of the camera, fading as it nears the edges
    const sun = scratch.sun.copy(uniforms.uSoleil.value).multiplyScalar(800).add(camera.position).project(camera)
    const facing = sun.z < 1 ? 1 - smoothstep(0.75, 1.15, Math.hypot(sun.x, sun.y)) : 0
    film.rays = facing * (1 - smoothstep(0, 0.4, uniforms.uNuit.value)) * smoothstep(-0.04, 0.06, uniforms.uSoleil.value.y)
    film.sun.set(sun.x * 0.5 + 0.5, sun.y * 0.5 + 0.5)
  }, FRAME_PRIORITY.stage)

  return (
    <CityContext.Provider value={city}>
      <group ref={rootRef} visible={false}>
        <primitive object={cameras.main} />
        <Sky meshRef={skyRef} />
        <Terrain />
        <Water mirrorCamera={cameras.mirror} sky={skyRef} />
        <Towers material={towerMaterial} />
        <LowRise material={towerMaterial} />
        <Observatory material={towerMaterial} />
        <Greenery />
        <Domes plinthMaterial={towerMaterial} />
        <Roads />
        <Beacons />
        <Shuttles />
        <SignalBeam />
        <AlertSpotlights alertLevel={alertLevel} />
        <DistrictMarkers />
        <Dust count={light ? 220 : 520} />
        <DescentClouds />
      </group>
    </CityContext.Provider>
  )
}

/** Cubic Bézier through a, b, c, d at t, written into `out` (which may be `d`). */
function bezier(a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number, out: Vector3): Vector3 {
  const s = 1 - t
  const ka = s * s * s
  const kb = 3 * s * s * t
  const kc = 3 * s * t * t
  const kd = t * t * t
  return out.set(
    a.x * ka + b.x * kb + c.x * kc + d.x * kd,
    a.y * ka + b.y * kb + c.y * kc + d.y * kd,
    a.z * ka + b.z * kb + c.z * kc + d.z * kd,
  )
}
