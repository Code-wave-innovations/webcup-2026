import { MathUtils, type PerspectiveCamera, type Vector3 } from 'three'
import { clamp, lerp, smoothstep } from '../../../lib/math'
import { CAMERA_POSES, LAST_POSE } from '../../city/cameraPath'

/** Render layer of Nova, its walkway and the overlays riding with the camera (descent clouds): drawn by the stage cameras, not by the lake's mirror camera. */
export const NOVA_LAYER = 1

/** Seconds Nova walks into the city frame before greeting. */
export const CITY_ENTRANCE_SECONDS = 1.6

/**
 * Nova's stage, in the space of the camera that films it: the origin is the floor under its feet (the
 * cockpit's glare shield, or the middle of the city walkway), with Nova 1 unit tall at `scale`.
 */
export interface StageFrame {
  /** origin, in camera space (x right, y up, -z forward) */
  x: number
  y: number
  z: number
  scale: number
  /**
   * What "up" is: the camera's (Nova rides in the cockpit, which moves with the view) or the world's
   * (Nova walks on the ground, and the camera looking down sees it from above).
   */
  up: 'camera' | 'world'
}

/** Writes the camera-space point seen at `ndc` (with the camera's view offset), at a view depth. */
export function cameraPoint(camera: PerspectiveCamera, ndcX: number, ndcY: number, depth: number, out: Vector3): Vector3 {
  out.set(ndcX, ndcY, 0.5).applyMatrix4(camera.projectionMatrixInverse)
  return out.multiplyScalar(depth / -out.z)
}

/** World size of a fraction of the screen height, at a view depth. */
export const screenHeightAt = (camera: PerspectiveCamera, fraction: number, depth: number) =>
  fraction * 2 * depth * Math.tan(MathUtils.degToRad(camera.fov) / 2)

// ————— cockpit —————

/** Nova is shown 1 unit tall; the cockpit frame is about 1.9 units deep in front of the pilot. */
const COCKPIT = {
  /** on the glare shield, left of the hologram emitter (x is scaled with the cockpit's width) */
  x: -0.025,
  /** top of the glare shield at that depth (it tilts slightly towards the canopy) */
  y: -0.226,
  z: -0.95,
  scale: 0.25,
  /** three-quarter view, turned towards the hologram */
  yaw: 0.22,
}

/**
 * On a phone the hologram covers the whole glare shield: Nova hovers in the canopy above it instead,
 * placed on screen, between the radio and the hologram.
 */
const PHONE_COCKPIT = { ndcX: 0.6, ndcY: 0.28, height: 0.15, depth: 0.6, yaw: -0.2 }

/** The cockpit is 1.6 times wider than tall; narrower screens squeeze it (see `SpaceStage`). */
export const cockpitWidthScale = (aspect: number) => clamp(aspect / 1.6, 0.36, 1.12)

/** Cockpit stage; returns the yaw Nova stands at. */
export function cockpitFrame(camera: PerspectiveCamera, aspect: number, out: StageFrame, scratch: Vector3): number {
  out.up = 'camera'
  if (aspect < 0.8) {
    const p = cameraPoint(camera, PHONE_COCKPIT.ndcX, PHONE_COCKPIT.ndcY, PHONE_COCKPIT.depth, scratch)
    out.x = p.x
    out.y = p.y
    out.z = p.z
    out.scale = screenHeightAt(camera, PHONE_COCKPIT.height, PHONE_COCKPIT.depth)
    return PHONE_COCKPIT.yaw
  }
  out.x = COCKPIT.x * cockpitWidthScale(aspect)
  out.y = COCKPIT.y
  out.z = COCKPIT.z
  out.scale = COCKPIT.scale
  return COCKPIT.yaw
}

// ————— city walkway —————

/** Desktop: a walkway along the bottom of the frame; Nova stands below each district, opposite the text. */
const WALKWAY = { ndcY: -0.9, height: 0.3, depth: 2.4, hero: 0.68, station: 0.6 }
/** Phone: the text fills the lower half; Nova stays on the right, above the title then under the top bar. */
const PHONE_WALKWAY = { ndcX: 0.6, heroY: 0.02, sectionY: 0.38, heroHeight: 0.2, sectionHeight: 0.16, depth: 2.4 }

/** Where Nova rests for section `index`: the hero corner, then under each district (its side of the frame). */
export function stationX(index: number): number {
  return index === 0 ? WALKWAY.hero : CAMERA_POSES[index].side * WALKWAY.station
}

/** Nova's spot on the walkway at scroll progress `u`, easing between stations like the camera flies. */
export interface WalkwaySpot {
  ndcX: number
  ndcY: number
  /** Nova's height, fraction of the screen height */
  height: number
  depth: number
}

export function walkwaySpot(u: number, phone: boolean, out: WalkwaySpot): WalkwaySpot {
  if (phone) {
    const away = smoothstep(0, 1, Math.min(1, u))
    out.ndcX = PHONE_WALKWAY.ndcX
    out.ndcY = lerp(PHONE_WALKWAY.heroY, PHONE_WALKWAY.sectionY, away)
    out.height = lerp(PHONE_WALKWAY.heroHeight, PHONE_WALKWAY.sectionHeight, away)
    out.depth = PHONE_WALKWAY.depth
    return out
  }
  const index = clamp(Math.floor(u), 0, LAST_POSE - 1)
  out.ndcX = lerp(stationX(index), stationX(index + 1), smoothstep(0, 1, clamp(u - index, 0, 1)))
  out.ndcY = WALKWAY.ndcY
  out.height = WALKWAY.height
  out.depth = WALKWAY.depth
  return out
}

/**
 * The Observatory's balcony (the chat): Nova large on the left of the frame, beside the conversation; on a
 * phone at the top of the screen, above it.
 */
const BALCONY = { ndcX: -0.5, ndcY: -0.97, height: 0.66, depth: 2.4 }
const PHONE_BALCONY = { ndcX: 0, ndcY: 0.26, height: 0.3, depth: 2.4 }

export function balconySpot(phone: boolean, out: WalkwaySpot): WalkwaySpot {
  const spot = phone ? PHONE_BALCONY : BALCONY
  out.ndcX = spot.ndcX
  out.ndcY = spot.ndcY
  out.height = spot.height
  out.depth = spot.depth
  return out
}

/** City stage: the walkway's middle under the spot. */
export function walkwayFrame(camera: PerspectiveCamera, spot: WalkwaySpot, out: StageFrame, scratch: Vector3): StageFrame {
  const p = cameraPoint(camera, 0, spot.ndcY, spot.depth, scratch)
  out.x = p.x
  out.y = p.y
  out.z = p.z
  out.scale = screenHeightAt(camera, spot.height, spot.depth)
  out.up = 'world'
  return out
}

/**
 * Position along the walkway (in Nova heights from its middle) of the screen abscissa `ndcX`: the walkway
 * runs along the camera's horizontal axis, so only x changes.
 */
export function walkwayX(camera: PerspectiveCamera, spot: WalkwaySpot, frame: StageFrame, ndcX: number, scratch: Vector3): number {
  return (cameraPoint(camera, ndcX, spot.ndcY, spot.depth, scratch).x - frame.x) / frame.scale
}

/** The section Nova is resting on (the camera has reached its pose), or null while flying between two. */
export function restingSection(u: number): number | null {
  const nearest = Math.round(u)
  return Math.abs(u - nearest) < 0.015 ? nearest : null
}

/** Rest yaw: turned a little towards the middle of the screen (the text and the visitor). */
export const restYaw = (ndcX: number) => -Math.sign(ndcX) * 0.18
