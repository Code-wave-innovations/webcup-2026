import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Object3D, Quaternion, Vector3, type DirectionalLight, type Group, type PerspectiveCamera } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { matchesQuery, PHONE_QUERY } from '../../../hooks/useMediaQuery'
import { clamp, damp } from '../../../lib/math'
import { DISTRICTS } from '../../city/districts'
import { NOVA_WORLD_SCALE, novaFlightFrame, type FlightPhase } from '../../city/explore/flightPath'
import { director } from '../../director/director'
import { frameState } from '../../director/frameState'
import { FRAME_PRIORITY } from '../../framePriority'
import { novaScenes } from '../behavior/scenes'
import { nova, novaNow, novaSignals } from '../behavior/novaStore'
import { Nova } from '../Nova'
import { NovaLighting, type NovaLightPreset } from '../NovaLighting'
import { NOVA_MODEL_URL } from '../novaModel'
import {
  balconySpot,
  CITY_ENTRANCE_SECONDS,
  cockpitFrame,
  NOVA_LAYER,
  restingSection,
  restYaw,
  walkwayFrame,
  walkwaySpot,
  walkwayX,
  type StageFrame,
  type WalkwaySpot,
} from './placement'
import { createWalkway, type Walkway } from './walkway'

// the model downloads with the rest of the film, behind the loading screen
if (NOVA_MODEL_URL) useGLTF.preload(NOVA_MODEL_URL, false, true)

const activeCamera = () => director.cameras[director.stage]
const UP = new Vector3(0, 1, 0)
const disposeWalkway = (walkway: Walkway) => walkway.dispose()

/** screen widths Nova walks in from when the city appears */
const ENTRANCE_SLIDE = 0.42
/** travel speed (Nova heights per second) that starts the walk, and the one under which it stops */
const WALK_START = 0.18
const WALK_STOP = 0.08
/** a walk ends after this long below the stop speed (no flicker between two scroll ticks) */
const STOP_DELAY = 0.18
/** on a phone Nova walks on the spot, its cadence following the scroll: heights per section */
const PHONE_STRIDE = 2.4
/** turned this far towards where it walks (a three-quarter view, the face stays readable) */
const WALK_HEADING = Math.PI * 0.42
/** rest that long on a district before presenting it */
const PRESENT_AFTER = 0.35
/** halfway between two districts, idle that long before asking to go on; and not more often than this */
const NUDGE_AFTER = 1.5
const NUDGE_EVERY = 30
/** half depth of the walkway; half width of the pad on phones (Nova heights) */
const WALKWAY_HALF_DEPTH = 0.42
const PHONE_PAD = 0.7
/** in the cockpit Nova walks to the spot it is asked to (`novaSignals.shift`) at this pace (heights per second) */
const COCKPIT_PACE = 0.5
/** during the entry Nova turns to the canopy (its back three-quarters to the pilot), braced on the glare shield */
const BRACE_YAW = 2.5
/** the re-entry plasma's glow on Nova, through the canopy in front of it */
const PLASMA_LIGHT = 5.5
/** on the Observatory's balcony the city behind Nova stays out of focus (the lights become bokeh) */
const BALCONY_FOCUS = 0.85
/** how fast focus is pulled onto Nova, then given back to the scene (rates, ~600 ms and ~900 ms) */
const FOCUS_IN = 5
const FOCUS_OUT = 3.2

interface Look {
  preset: NovaLightPreset
  scale: number
}

/**
 * Nova in the film: a single body for the whole visit, carried by the active camera like a guide layer
 * (always readable whatever the camera does) but lit like the scene it stands in. On the cockpit's glare
 * shield in orbit; in the city on a holographic walkway along the bottom of the frame, where it walks
 * from district to district as the page scrolls (its feet keep pace with the distance), turns back when
 * the visitor scrolls back, and presents each district with its arm when the camera rests on it.
 */
export function NovaActor({ light }: { light: boolean }) {
  const frameRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const plasmaRef = useRef<DirectionalLight>(null)
  const [plasmaTarget] = useState(() => new Object3D())
  const size = useThree((s) => s.size)
  const [look, setLook] = useState<Look>({ preset: 'airlock', scale: 0.25 })
  const walkway = useMemo(() => {
    const created = createWalkway()
    created.mesh.layers.set(NOVA_LAYER)
    return created
  }, [])
  useDisposeOnUnmount(walkway, disposeWalkway)

  const m = useMemo(
    () => ({
      frame: { x: 0, y: 0, z: 0, scale: 1, up: 'camera' } as StageFrame,
      spot: { ndcX: 0, ndcY: 0, height: 0, depth: 0 } as WalkwaySpot,
      inCity: false,
      /** standing (or flying) in the world at full size, rather than on the walkway */
      inWorld: false,
      flightPhase: null as FlightPhase | null,
      /** on the Observatory's balcony (the chat) rather than the flyover's walkway */
      onBalcony: false,
      stage: '' as string,
      /** cockpit: where Nova stands along the glare shield (heights) */
      shift: 0,
      /** 0 → 1 while walking into the city frame */
      entrance: 1,
      x: 0,
      u: 0,
      pace: 0,
      direction: -1,
      walking: false,
      slowFor: 0,
      heading: 0,
      restFor: 0,
      pausedFor: 0,
      nudgeReady: 0,
      presenting: false,
      visited: new Set<number>(),
      point: new Vector3(),
      local: new Vector3(),
      forward: new Vector3(),
      feet: new Vector3(),
      turn: new Quaternion(),
    }),
    [],
  )

  const setWalking = useCallback(
    (walking: boolean) => {
      if (walking === m.walking) return
      m.walking = walking
      nova.walk(walking)
    },
    [m],
  )

  const setPresenting = useCallback(
    (presenting: boolean) => {
      if (presenting === m.presenting) return
      m.presenting = presenting
      nova.hold('present', presenting)
    },
    [m],
  )

  // each footstep lights a hexagon where it lands on the walkway
  const onStep = useCallback(
    (foot: Vector3) => {
      const frame = frameRef.current
      if (!frame || director.stage !== 'city') return
      const local = frame.worldToLocal(m.local.copy(foot))
      walkway.step(local.x, local.z, director.time)
    },
    [m, walkway],
  )

  useFrame(() => {
    const frame = frameRef.current
    const body = bodyRef.current
    const stage = director.stage
    const camera = director.cameras[stage] as PerspectiveCamera | null
    if (!frame || !body || !camera) return
    camera.layers.enable(NOVA_LAYER)
    const dt = director.dt
    const now = novaNow()
    const reduced = director.reducedMotion
    const city = stage === 'city'
    const inCity = city && director.inCity
    const onGround = director.novaInWorld
    const onBalcony = inCity && director.observatory > 0.5 && !onGround
    rackFocus(dt, now, size, onBalcony && !matchesQuery(PHONE_QUERY) ? BALCONY_FOCUS * director.observatory : 0)

    if (inCity && !m.inCity) {
      // a new arrival in the city: walk in, every district is new again
      m.entrance = reduced ? 1 : 0
      m.visited.clear()
    }
    if (inCity && onBalcony !== m.onBalcony) {
      // from the walkway to the balcony and back: Nova walks in again
      m.entrance = reduced ? 1 : 0
      setPresenting(false)
    }
    if (inCity && !onGround && m.inWorld) {
      // gone up out of the frame on the way back to the flyover: Nova walks onto the walkway again
      m.entrance = reduced ? 1 : 0
    }
    m.inWorld = onGround
    m.onBalcony = onBalcony
    m.inCity = inCity
    poseForFlight(m, director.flight?.phase ?? null)
    frame.visible = city ? inCity : true
    if (!frame.visible) {
      setWalking(false)
      setPresenting(false)
      return
    }
    m.entrance = Math.min(1, m.entrance + dt / CITY_ENTRANCE_SECONDS)
    const entering = 1 - Math.pow(1 - m.entrance, 2)
    const u = director.scrollSmooth
    const phone = matchesQuery(PHONE_QUERY)

    // ——— where the stage is, where Nova stands on it ———
    let yaw: number
    let x: number
    const f = m.frame
    if (onGround) {
      const nova = director.roam.nova
      f.x = nova.x
      f.y = nova.y
      f.z = nova.z
      f.scale = NOVA_WORLD_SCALE
      f.up = 'world'
      x = 0
      yaw = 0
    } else if (city) {
      if (onBalcony) balconySpot(phone, m.spot)
      else walkwaySpot(u, phone, m.spot)
      walkwayFrame(camera, m.spot, f, m.point)
      // onto the walkway from the right, onto the balcony from the left
      const slide = (1 - entering) * ENTRANCE_SLIDE * (onBalcony ? -1 : 1)
      x = walkwayX(camera, m.spot, f, m.spot.ndcX + slide * 2, m.point)
      yaw = restYaw(m.spot.ndcX)
      const left = phone ? x - PHONE_PAD : walkwayX(camera, m.spot, f, -1.15, m.point)
      const right = phone ? x + PHONE_PAD : walkwayX(camera, m.spot, f, 1.15, m.point)
      const w = walkway.uniforms
      w.uCenter.value = (left + right) / 2
      w.uHalf.value.set((right - left) / 2, WALKWAY_HALF_DEPTH)
      w.uNovaX.value = x
      w.uTime.value = director.time
      w.uOpacity.value = entering
      w.uActivity.value += ((m.walking ? 1 : 0) - w.uActivity.value) * damp(4, dt)
    } else {
      yaw = cockpitFrame(camera, size.width / size.height, f, m.point)
      // a few steps along the glare shield (towards the hologram while the visitor types); hovering on phones
      const target = phone ? 0 : novaSignals.shift
      const stride = COCKPIT_PACE * dt
      m.shift = reduced ? target : m.shift + clamp(target - m.shift, -stride, stride)
      x = m.shift
    }
    walkway.mesh.visible = city && !onBalcony && !onGround

    if (onGround) {
      // heading, banked into the turns, tilted into the flight around the waist
      novaFlightFrame(director.roam.nova, NOVA_WORLD_SCALE, frame.position, frame.quaternion)
    } else {
      frame.position.set(f.x, f.y, f.z).applyMatrix4(camera.matrixWorld)
      if (f.up === 'camera') {
        camera.getWorldQuaternion(frame.quaternion)
      } else {
        camera.getWorldDirection(m.forward)
        frame.quaternion.setFromAxisAngle(UP, Math.atan2(-m.forward.x, -m.forward.z))
      }
    }
    frame.scale.setScalar(f.scale)
    body.position.set(x, 0, 0)
    if (inCity && !onGround && !onBalcony) {
      // the explore flight takes off from here: the walkway's Nova at full size, at the same place on screen
      body.updateWorldMatrix(true, false)
      const feet = body.getWorldPosition(m.feet)
      const grow = NOVA_WORLD_SCALE / f.scale
      const launch = director.launch
      launch.x = camera.position.x + (feet.x - camera.position.x) * grow
      launch.y = camera.position.y + (feet.y - camera.position.y) * grow
      launch.z = camera.position.z + (feet.z - camera.position.z) * grow
      launch.yaw = Math.atan2(camera.position.x - feet.x, camera.position.z - feet.z)
      launch.valid = m.entrance >= 1
    } else {
      director.launch.valid = false
    }

    // ——— walking: the cadence follows the distance travelled (on a phone, the scroll) ———
    if (stage !== m.stage) {
      // a cut to the other stage is not a step
      m.stage = stage
      m.x = x
      m.u = u
    }
    const travel = onGround
      ? director.flying ? 0 : director.roam.nova.speed / NOVA_WORLD_SCALE
      : dt > 0
        ? city && phone
          ? ((u - m.u) / dt) * PHONE_STRIDE
          : (x - m.x) / dt
        : 0
    m.x = x
    m.u = u
    m.pace += (Math.abs(travel) - m.pace) * damp(10, dt)
    if (!onGround && Math.abs(travel) > 0.05) m.direction = Math.sign(travel)
    if (reduced) {
      setWalking(false)
    } else if (!m.walking && m.pace > WALK_START) {
      setWalking(true)
    } else if (m.walking) {
      m.slowFor = m.pace < WALK_STOP ? m.slowFor + dt : 0
      if (m.slowFor > STOP_DELAY) setWalking(false)
    }
    novaSignals.pace = m.walking ? m.pace : 0

    // ——— resting on a district: present it, arm towards its landmark ———
    // on a phone the camera follows the text continuously: Nova rests wherever the scroll stops
    const resting = city && !onBalcony && !onGround && m.entrance >= 1 ? (phone ? director.section : restingSection(u)) : null
    m.restFor = resting !== null && !m.walking ? m.restFor + dt : 0
    const district = resting !== null ? DISTRICTS[resting] : undefined
    const present = !!district && resting! > 0 && m.restFor > PRESENT_AFTER
    const anchor = district?.anchor ? frameState.anchors[district.anchor] : null
    if (present && !m.presenting) {
      // a glance at the district first, then back to the visitor
      if (anchor?.visible) novaSignals.glance = { x: anchor.x, y: anchor.y, until: now + 0.6 }
      novaScenes.presentDistrict(district, !m.visited.has(resting!))
      m.visited.add(resting!)
    }
    setPresenting(present)

    // ——— halfway between two districts with the scroll stopped: "shall we go on?" ———
    m.pausedFor = city && !onBalcony && !onGround && !phone && m.entrance >= 1 && resting === null && !m.walking ? m.pausedFor + dt : 0
    if (m.pausedFor > NUDGE_AFTER && now > m.nudgeReady) {
      m.nudgeReady = now + NUDGE_EVERY
      novaScenes.nudge()
    }

    // ——— facing: where it walks, the landmark it presents, or the visitor ———
    let heading = 0
    if (onGround) {
      heading = 0
    } else if (!city && director.entry) {
      heading = BRACE_YAW - yaw
    } else if (m.walking) {
      heading = m.direction * WALK_HEADING
    } else if (m.presenting) {
      const box = frameState.nova.box
      const towards = anchor?.visible ? anchor.x - (box.left + box.width / 2) : 0
      heading = clamp(towards / (size.width * 0.25), -1, 1) * 1.05 - yaw
    }
    // turning back takes ~180 ms (anticipation before the walk the other way)
    m.heading += (heading - m.heading) * damp(m.walking ? 11 : 6, dt)
    body.quaternion.setFromAxisAngle(UP, yaw + m.heading)

    // the plasma lights Nova from the canopy, flickering with the flames
    const plasmaLight = plasmaRef.current
    if (plasmaLight) {
      const glow = city ? 0 : director.cues.plasma
      plasmaLight.visible = glow > 0.001
      plasmaLight.intensity = glow * PLASMA_LIGHT * (0.8 + 0.2 * Math.sin(director.time * 23) * Math.sin(director.time * 7.3))
    }

    // light of the place: the cockpit, then the city as the sun goes down
    const preset: NovaLightPreset = !city ? 'airlock' : frameState.dusk < 0.55 ? 'dusk' : 'night'
    const scale = Math.round(f.scale * 100) / 100
    if (preset !== look.preset || scale !== look.scale) setLook({ preset, scale })
  }, FRAME_PRIORITY.details)

  return (
    <group ref={frameRef} visible={false}>
      <NovaLighting preset={look.preset} shadows={!light} scale={look.scale} />
      <primitive object={plasmaTarget} position={[0, 0.5, 0]} />
      <directionalLight ref={plasmaRef} target={plasmaTarget} position={[0.4, 1.6, -3]} color="#ff7a32" intensity={0} visible={false} />
      <primitive object={walkway.mesh} />
      <group ref={bodyRef}>
        <Nova modelUrl={NOVA_MODEL_URL} whileLoading="suspend" interactive={false} camera={activeCamera} layer={NOVA_LAYER} onStep={onStep} />
      </group>
    </group>
  )
}

/** The flight's postures: crouched before the burst, flying, then the superhero landing (a one-shot gesture). */
function poseForFlight(m: { flightPhase: FlightPhase | null }, phase: FlightPhase | null) {
  if (phase === m.flightPhase) return
  const airborne = (p: FlightPhase | null) => p === 'takeoff' || p === 'cruise' || p === 'flare'
  if ((phase === 'crouch') !== (m.flightPhase === 'crouch')) nova.hold('crouch', phase === 'crouch')
  if (airborne(phase) !== airborne(m.flightPhase)) nova.hold('fly', airborne(phase))
  if (phase === 'landing') nova.gesture('land')
  m.flightPhase = phase
}

/**
 * Rack focus: while Nova has the spotlight (a strong reaction), the film throws everything but Nova out of
 * focus, then gives the focus back to the scene; `base` keeps it partly pulled (the balcony's bokeh).
 */
function rackFocus(dt: number, now: number, size: { width: number; height: number }, base: number) {
  const film = director.film
  const { box } = frameState.nova
  const pull = box.visible ? Math.max(base, now < novaSignals.spotlightUntil ? 1 : 0) : 0
  film.focusPull += (pull - film.focusPull) * damp(pull > film.focusPull ? FOCUS_IN : FOCUS_OUT, dt)
  if (film.focusPull < 0.002) film.focusPull = 0
  if (box.visible) film.focus.set((box.left + box.width / 2) / size.width, 1 - (box.top + box.height / 2) / size.height, (box.height / size.height) * 0.62)
}
