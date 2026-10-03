import type { Camera } from 'three'
import { Vector3 } from 'three'
import { clamp, damp, smoothstep } from '../../lib/math'
import { createPathSample, LAST_POSE, sampleCameraPath } from '../city/cameraPath'
import { poiById, type PoiId, type POI } from '../city/cityConfig'
import { ExploreCameraRig, LANDING_ORBIT } from '../city/explore/exploreCamera'
import { exploreCollision } from '../city/explore/exploreCollision'
import { tickExploreMove } from '../city/explore/exploreMove'
import { createFlightSample, CROUCH_SECONDS, planExit, planFlight, sampleFlight, type FlightPhase, type FlightPlan, type FlightSample } from '../city/explore/flightPath'
import { relief } from '../city/layout/relief'
import { createFilmControls } from '../post/FilmEffect'
import { debugParams } from './debugParams'
import type { ExploreStatus, FilmPhase } from './directorStore'
import { createEntryTimeline, restingCues, type EntryTimeline } from './timelines/entryTimeline'

export type Stage = 'space' | 'city'

/** Shared explore state: Nova's pose (feet, heading, tilt in the air), the orbit camera, the stick. */
export interface ExploreRoam {
  nova: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number }
  orbit: { yaw: number; pitch: number }
  move: { x: number; z: number }
}

/** Nova in the air: `phase` and `speed` (share of the cruise speed) are read every frame by the stage and the sound. */
export interface ActiveFlight {
  phase: FlightPhase
  speed: number
  readonly plan: FlightPlan
  /** seconds since the flight started */
  t: number
  readonly sample: FlightSample
  /** the site it lands on; null on the way back to the flyover */
  readonly destination: PoiId | null
}

/** Where Nova would stand if the walkway's Nova were full size in the world (same place on screen), written by its stage. */
export interface ExploreLaunch {
  x: number
  y: number
  z: number
  yaw: number
  valid: boolean
}

const OPENING_SECONDS = 1.8
/** the camera rises from the flyover to the Observatory's balcony (the chat) */
const OBSERVATORY_SECONDS = 1.6
const EXPLORE_SECONDS = 0.8
/** the camera glides back to the flyover once Nova has shot up out of the frame */
const RETURN_SECONDS = 2.4
const RETURN_AFTER = 1.3
/** where Nova lands when the visitor steps into the city */
const FIRST_SITE: PoiId = 'golf'
const RETURN_FADE_OUT = 0.6
const RETURN_FADE_IN = 1.4
const WARM_WHITE = [1.0, 0.8, 0.58] as const

/**
 * Conducts the film: opening fade, atmospheric entry, descent, return to the airlock, and the smoothed
 * scroll and pointer the stages read. Pure timing state (no rendering), advanced once per frame.
 */
export class FilmDirector {
  readonly film = createFilmControls()
  readonly cameras: Record<Stage, Camera | null> = { space: null, city: null }
  readonly reducedMotion: boolean

  phase: FilmPhase = 'approach'
  /** seconds since the film started */
  time = 0
  /** duration of the current frame, clamped so a stalled tab does not jump the film */
  dt = 0
  /** cockpit: slow approach of the planet while waiting (0 → 1 over two minutes) */
  approach = 0
  /** null outside the entry; `t` in seconds since access was granted */
  entry: { t: number; timeline: EntryTimeline; arrived: boolean } | null = null
  /** what the entry drives this frame (resting values outside it), read by the stages */
  cues = restingCues()
  /** scroll progress on the camera path, as requested by the page and smoothed */
  scrollTarget = 0
  scrollSmooth = 0
  /** section of the city page being read (the most revealed one), as reported by the page */
  section = 0
  /** 0 on the flyover → 1 on the Observatory's balcony, eased (the chat page) */
  observatory = 0
  /** 0 on the flyover → 1 on the explore camera, eased */
  exploreBlend = 0
  /** the site Nova stands on (null on the flyover or in the air) */
  site: PoiId | null = null
  /** Nova's Iron Man flight (null on the ground) */
  flight: ActiveFlight | null = null
  readonly roam: ExploreRoam = {
    nova: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0 },
    orbit: { yaw: 0, pitch: 0.42 },
    move: { x: 0, z: 0 },
  }
  readonly launch: ExploreLaunch = { x: 0, y: 0, z: 0, yaw: 0, valid: false }
  /** the explore camera, read by the city stage */
  readonly exploreCamera = new ExploreCameraRig()
  readonly pointer = { x: 0, y: 0 }
  readonly pointerSmooth = { x: 0, y: 0 }

  private opening = 0
  private observatoryGoal = 0
  private observatoryClock = 0
  private exploreClock = 0
  /** back to the flyover: the return starts once Nova has left the frame */
  private leaving: { started: boolean } | null = null
  private savedScroll = 0
  private published = ''
  private returning: { t: number; switched: boolean } | null = null
  private readonly onPhase: (phase: FilmPhase) => void
  private readonly onExplore: (status: ExploreStatus) => void

  constructor(onPhase: (phase: FilmPhase) => void, reducedMotion: boolean, onExplore: (status: ExploreStatus) => void = () => {}) {
    this.onPhase = onPhase
    this.reducedMotion = reducedMotion
    this.onExplore = onExplore
  }

  /** descent progress (eased), 1 once the camera has reached the flyover path */
  get arrival(): number {
    return this.cues.arrival
  }

  get stage(): Stage {
    return this.phase === 'descent' || this.phase === 'city' || this.phase === 'explore' ? 'city' : 'space'
  }

  /** The city interface is up (flyover or ground walk). */
  get inCity(): boolean {
    return this.phase === 'city' || this.phase === 'explore'
  }

  /** The visitor explores with Nova (flying or walking), not on the way back to the flyover. */
  get exploring(): boolean {
    return this.phase === 'explore' && !this.leaving
  }

  /** Nova is in the air (or landing). */
  get flying(): boolean {
    return this.flight !== null
  }

  /** Nova stands in the world at full size (otherwise it is on the flyover's walkway, or gone up out of the frame). */
  get novaInWorld(): boolean {
    return this.phase === 'explore' && !(this.leaving && !this.flight)
  }

  /** Applies the `?vue`, `?entree` and `?arrivee` jumps, otherwise waits in the cockpit. */
  start(): void {
    const { view, entry, arrival } = debugParams
    if (view !== undefined) {
      this.land(view)
    } else if (entry !== undefined) {
      this.skipOpening()
      this.startEntry(entry)
    } else if (arrival !== undefined) {
      this.skipOpening()
      const started = this.startEntry(0)
      const { cut, end } = started.timeline.marks
      started.t = cut + arrival * (end - cut)
    } else {
      this.setPhase('approach')
    }
  }

  /** Straight to the city without the entry: reload of /ville, or the `?vue` jump. */
  land(view = 0): void {
    this.endEntry()
    this.returning = null
    this.clearExplore()
    this.scrollTarget = this.scrollSmooth = view
    this.skipOpening()
    this.setPhase('descent')
    this.setPhase('city')
  }

  /** Access granted: launch the atmospheric entry. */
  enter(): void {
    if (!this.entry) this.startEntry(0)
  }

  /** "Skip": jump to the white-out, or close to the end of the descent if already over the city. */
  skip(): void {
    if (!this.entry) return
    const { cut, end } = this.entry.timeline.marks
    const whiteOut = cut - 0.7
    this.entry.t = this.phase === 'entry' ? Math.max(this.entry.t, whiteOut) : Math.max(this.entry.t, end - 0.6)
  }

  /** Log out: fade to black and back to the cockpit. */
  exit(): void {
    this.endEntry()
    this.clearExplore()
    this.observatoryGoal = this.observatoryClock = this.observatory = 0
    if (!this.returning) this.returning = { t: 0, switched: false }
  }

  /**
   * Nova takes off from the walkway, Iron Man style, and lands on a site (the golf course unless told otherwise); the
   * camera leaves the flyover to chase it. `instant` (and reduced motion) puts Nova straight on the site.
   */
  enterExplore(siteId: PoiId = FIRST_SITE, instant = false): void {
    if (this.phase !== 'city') return
    this.savedScroll = this.scrollSmooth
    this.leaving = null
    this.site = null
    const pose = sampleCameraPath(this.scrollSmooth, createPathSample())
    const position = new Vector3().fromArray(pose.position)
    const target = new Vector3().fromArray(pose.target)
    this.exploreCamera.reset(position, target, pose.focal)
    this.setPhase('explore')
    if (instant || this.reducedMotion) {
      this.placeOn(poiById(siteId))
      this.exploreClock = this.exploreBlend = 1
    } else {
      const launch = this.launchPoint(position, target)
      const { nova } = this.roam
      nova.x = launch.x
      nova.y = launch.y
      nova.z = launch.z
      nova.yaw = launch.yaw
      this.flyTowards(siteId)
    }
    this.publish()
  }

  /** From the site Nova stands on, flies to another one. */
  flyTo(siteId: PoiId): void {
    if (this.phase !== 'explore' || this.leaving || this.flight || this.site === siteId) return
    if (this.reducedMotion) {
      this.placeOn(poiById(siteId))
      this.exploreCamera.snapToOrbit(this.roam, this.site)
    } else {
      this.flyTowards(siteId)
    }
    this.publish()
  }

  /**
   * Back to the flyover at the scroll position saved when exploring started: Nova shoots up out of the frame, then
   * the camera glides back (`instant`: at once, when the page is left).
   */
  exitExplore(instant = false): void {
    if (this.phase !== 'explore') return
    this.scrollTarget = this.savedScroll
    if (instant || this.reducedMotion) {
      this.clearExplore()
      this.setPhase('city')
      return
    }
    if (this.leaving) return
    // already in the air towards a site: the camera goes back at once
    this.leaving = { started: !!this.flight }
    this.roam.move.x = this.roam.move.z = 0
    if (!this.flight) {
      const { nova } = this.roam
      this.startFlight(planExit(new Vector3(nova.x, nova.y, nova.z), nova.yaw), null)
      this.site = null
    }
    this.publish()
  }
  /** Flies the city camera up to the Observatory's balcony, or back down to the flyover. */
  visitObservatory(on: boolean): void {
    this.observatoryGoal = on ? 1 : 0
  }

  setScroll(u: number): void {
    this.scrollTarget = clamp(u, 0, LAST_POSE)
  }

  tick(dt: number): void {
    this.dt = dt
    this.time += dt
    this.film.time = this.time
    this.pointerSmooth.x += (this.pointer.x - this.pointerSmooth.x) * 0.05
    this.pointerSmooth.y += (this.pointer.y - this.pointerSmooth.y) * 0.05

    if (this.opening < 1 && !this.entry && !this.returning) {
      this.opening = Math.min(1, this.opening + dt / OPENING_SECONDS)
      this.film.veilColor.setRGB(0, 0, 0)
      this.film.veil = 1 - this.opening
    }
    if (this.observatoryClock !== this.observatoryGoal) {
      const step = this.reducedMotion ? 1 : dt / OBSERVATORY_SECONDS
      this.observatoryClock = this.observatoryGoal > this.observatoryClock ? Math.min(1, this.observatoryClock + step) : Math.max(0, this.observatoryClock - step)
      this.observatory = 0.5 - 0.5 * Math.cos(Math.PI * this.observatoryClock)
    }
    if (this.phase === 'explore') this.tickExplore(dt)
    if (this.entry) this.tickEntry(dt, this.entry)
    if (this.returning) this.tickReturn(dt, this.returning)
  }

  private startEntry(t: number) {
    const timeline = createEntryTimeline(this.reducedMotion)
    this.entry = { t, timeline, arrived: false }
    this.cues = timeline.cues
    this.setPhase('entry')
    return this.entry
  }

  private endEntry() {
    this.entry?.timeline.kill()
    this.entry = null
    this.cues = restingCues()
  }

  /** Advances the entry's clock; the timeline sets every cue, the director only switches phases. */
  private tickEntry(dt: number, entry: NonNullable<FilmDirector['entry']>) {
    if (!debugParams.frozen) entry.t += dt
    const { marks } = entry.timeline
    entry.timeline.seek(entry.t)
    this.film.veilColor.setRGB(...WARM_WHITE)
    this.film.veil = this.cues.veil
    if (this.phase === 'entry' && entry.t >= marks.cut) {
      this.scrollTarget = this.scrollSmooth = 0
      this.setPhase('descent')
    }
    if (this.phase === 'descent' && entry.t >= marks.arrive && !entry.arrived) {
      entry.arrived = true
      this.setPhase('city')
    }
    if (entry.t >= marks.end && entry.arrived) this.endEntry()
  }

  private tickReturn(dt: number, returning: { t: number; switched: boolean }) {
    returning.t += dt
    this.film.veilColor.setRGB(0, 0, 0)
    if (returning.t < RETURN_FADE_OUT) {
      this.film.veil = returning.t / RETURN_FADE_OUT
    } else if (!returning.switched) {
      returning.switched = true
      this.approach = 0
      this.scrollTarget = this.scrollSmooth = 0
      this.setPhase('approach')
    } else {
      this.film.veil = Math.max(0, 1 - (returning.t - RETURN_FADE_OUT) / RETURN_FADE_IN)
      if (returning.t > RETURN_FADE_OUT + RETURN_FADE_IN) {
        this.returning = null
        this.film.veil = 0
      }
    }
  }

  private skipOpening() {
    this.opening = 1
    this.film.veil = 0
  }

  private clearExplore() {
    this.exploreClock = this.exploreBlend = 0
    this.flight = null
    this.leaving = null
    this.site = null
    this.roam.move.x = this.roam.move.z = 0
    this.roam.nova.speed = 0
    this.publish()
  }

  /** Flight, walk and camera of the explore mode, then the blend with the flyover. */
  private tickExplore(dt: number) {
    const { nova } = this.roam
    const flight = this.flight
    const rig = this.exploreCamera
    if (flight) {
      flight.t += dt
      const sample = sampleFlight(flight.plan, flight.t, flight.sample)
      nova.x = sample.position.x
      nova.y = sample.position.y
      nova.z = sample.position.z
      nova.yaw += wrapAngle(sample.yaw - nova.yaw) * damp(14, dt)
      nova.pitch = sample.pitch
      nova.roll = sample.roll
      nova.speed = 0
      flight.phase = sample.phase
      flight.speed = sample.speed
      const { arrival, brake } = flight.plan
      const landing = flight.destination ? smoothstep(0.35, 1, (flight.t - (arrival - brake)) / brake) : 0
      rig.followFlight(this.roam, sample, landing, flight.destination, dt)
      if (flight.t >= flight.plan.duration) {
        this.flight = null
        nova.pitch = nova.roll = 0
        if (flight.destination) this.site = flight.destination
      }
      if (this.leaving && !this.leaving.started && (!this.flight || (flight.destination === null && flight.t > CROUCH_SECONDS + RETURN_AFTER))) {
        this.leaving.started = true
      }
    } else if (this.leaving) {
      this.leaving.started = true
    } else {
      tickExploreMove(this.roam, dt, this.site ? poiById(this.site) : null)
      rig.followOrbit(this.roam, this.site, dt)
    }

    // into the explore camera, and back to the flyover once Nova has left the frame
    const goal = this.leaving?.started ? 0 : 1
    if (this.exploreClock !== goal) {
      const step = this.reducedMotion ? 1 : dt / (goal ? EXPLORE_SECONDS : RETURN_SECONDS)
      this.exploreClock = goal ? Math.min(1, this.exploreClock + step) : Math.max(0, this.exploreClock - step)
      this.exploreBlend = 0.5 - 0.5 * Math.cos(Math.PI * this.exploreClock)
    }
    if (goal === 0 && this.exploreClock === 0) {
      this.clearExplore()
      this.setPhase('city')
      return
    }
    this.publish()
  }

  private startFlight(plan: FlightPlan, destination: PoiId | null) {
    const sample = sampleFlight(plan, 0, createFlightSample())
    this.flight = { phase: sample.phase, speed: 0, plan, t: 0, sample, destination }
    this.roam.move.x = this.roam.move.z = 0
    this.roam.nova.speed = 0
  }

  /** Plans the flight from where Nova is to the landing spot of `siteId`; the touchdown is framed from a low three-quarter front. */
  private flyTowards(siteId: PoiId) {
    const site = poiById(siteId)
    const { nova } = this.roam
    const spot = this.landingSpot(site)
    const skyline = exploreCollision()?.skyline
    const plan = planFlight(new Vector3(nova.x, nova.y, nova.z), spot, nova.yaw, skyline)
    this.roam.orbit.yaw = plan.departYaw + LANDING_ORBIT.yaw
    this.roam.orbit.pitch = LANDING_ORBIT.pitch
    this.site = null
    this.startFlight(plan, siteId)
  }

  private landingSpot(site: POI): Vector3 {
    const snap = exploreCollision()?.snap(site.x, site.z, site)
    return snap ? new Vector3(snap.x, snap.y, snap.z) : new Vector3(site.x, Math.max(relief(site.x, site.z), 0), site.z)
  }

  /** Nova standing on a site, facing the city, the camera behind it. */
  private placeOn(site: POI) {
    const spot = this.landingSpot(site)
    const { nova, orbit } = this.roam
    nova.x = spot.x
    nova.y = spot.y
    nova.z = spot.z
    nova.yaw = Math.atan2(-site.x, -site.z)
    nova.pitch = nova.roll = nova.speed = 0
    orbit.yaw = nova.yaw + Math.PI
    orbit.pitch = 0.32
    this.flight = null
    this.site = site.id
    this.exploreCamera.snapToOrbit(this.roam, this.site)
  }

  /** Where Nova takes off: the walkway's Nova at full size (same place on screen), or in front of the camera. */
  private launchPoint(position: Vector3, target: Vector3): ExploreLaunch {
    if (this.launch.valid) return this.launch
    const ahead = target.clone().sub(position).normalize()
    const point = position.clone().addScaledVector(ahead, 14)
    return { x: point.x, y: point.y - 3, z: point.z, yaw: Math.atan2(-ahead.x, -ahead.z), valid: true }
  }

  /** Tells the interface where the visit stands (only when it changes). */
  private publish() {
    const status: ExploreStatus = {
      site: this.site,
      destination: this.flight?.destination ?? null,
      flight: this.flight?.phase ?? null,
      leaving: !!this.leaving,
    }
    const key = `${status.site}|${status.destination}|${status.flight}|${status.leaving}`
    if (key === this.published) return
    this.published = key
    this.onExplore(status)
  }

  private setPhase(phase: FilmPhase) {
    this.phase = phase
    this.onPhase(phase)
  }
}

const wrapAngle = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))
