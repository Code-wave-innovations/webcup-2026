import type { Camera } from 'three'
import { clamp, smoothstep } from '../../lib/math'
import { LAST_POSE } from '../city/cameraPath'
import { createFilmControls } from '../post/FilmEffect'
import { debugParams } from './debugParams'
import type { FilmPhase } from './directorStore'

export type Stage = 'space' | 'city'

/** Timeline of the atmospheric entry, in seconds from the moment access is granted. */
export const ENTRY = {
  /** reduced motion starts here: straight into the white-out */
  reducedStart: 4.2,
  whiteOut: [4.2, 4.9] as const,
  /** the film cuts from the cockpit to the city */
  cut: 4.9,
  fadeIn: [4.9, 6.4] as const,
  /** the city interface appears */
  arrive: 7.4,
  descentSeconds: 5.4,
}

const OPENING_SECONDS = 1.8
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
  entry: { t: number; arrived: boolean } | null = null
  /** descent progress, 1 once the camera has reached the flyover path */
  arrival = 1
  /** scroll progress on the camera path, as requested by the page and smoothed */
  scrollTarget = 0
  scrollSmooth = 0
  readonly pointer = { x: 0, y: 0 }
  readonly pointerSmooth = { x: 0, y: 0 }

  private opening = 0
  private returning: { t: number; switched: boolean } | null = null
  private readonly onPhase: (phase: FilmPhase) => void

  constructor(onPhase: (phase: FilmPhase) => void, reducedMotion: boolean) {
    this.onPhase = onPhase
    this.reducedMotion = reducedMotion
  }

  get stage(): Stage {
    return this.phase === 'descent' || this.phase === 'city' ? 'city' : 'space'
  }

  /** Applies the `?vue`, `?entree` and `?arrivee` jumps, otherwise waits in the cockpit. */
  start(): void {
    const { view, entry, arrival } = debugParams
    if (view !== undefined) {
      this.land(view)
    } else if (entry !== undefined) {
      this.entry = { t: entry, arrived: false }
      this.skipOpening()
      this.setPhase('entry')
    } else if (arrival !== undefined) {
      this.arrival = arrival
      this.entry = { t: 5.6, arrived: false }
      this.opening = 1
      this.setPhase('descent')
    } else {
      this.setPhase('approach')
    }
  }

  /** Straight to the city without the entry: reload of /ville, or the `?vue` jump. */
  land(view = 0): void {
    this.entry = null
    this.returning = null
    this.arrival = 1
    this.scrollTarget = this.scrollSmooth = view
    this.skipOpening()
    this.setPhase('descent')
    this.setPhase('city')
  }

  /** Access granted: launch the atmospheric entry. */
  enter(): void {
    if (this.entry) return
    this.entry = { t: this.reducedMotion ? ENTRY.reducedStart : 0, arrived: false }
    this.setPhase('entry')
  }

  /** "Skip": jump to the white-out, or to the end of the descent if already in the city. */
  skip(): void {
    if (!this.entry) return
    if (this.phase === 'entry' && this.entry.t < ENTRY.reducedStart) {
      this.entry.t = ENTRY.reducedStart
    } else {
      this.arrival = Math.max(this.arrival, 0.92)
      this.entry.t = Math.max(this.entry.t, ENTRY.arrive)
    }
  }

  /** Log out: fade to black and back to the cockpit. */
  exit(): void {
    this.entry = null
    this.arrival = 1
    if (!this.returning) this.returning = { t: 0, switched: false }
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
    if (this.entry) this.tickEntry(dt, this.entry)
    if (this.returning) this.tickReturn(dt, this.returning)
  }

  private tickEntry(dt: number, entry: { t: number; arrived: boolean }) {
    if (!debugParams.frozen) entry.t += dt
    if (this.phase === 'entry') {
      this.film.veilColor.setRGB(...WARM_WHITE)
      this.film.veil = smoothstep(ENTRY.whiteOut[0], ENTRY.whiteOut[1], entry.t)
      if (entry.t >= ENTRY.cut) {
        this.arrival = 0
        this.scrollTarget = this.scrollSmooth = 0
        this.setPhase('descent')
      }
      return
    }
    if (!debugParams.frozen) this.arrival = Math.min(1, this.arrival + dt / ENTRY.descentSeconds)
    this.film.veil = 1 - smoothstep(ENTRY.fadeIn[0], ENTRY.fadeIn[1], entry.t)
    if (entry.t > ENTRY.arrive && !entry.arrived) {
      entry.arrived = true
      this.setPhase('city')
    }
    if (this.arrival >= 1 && entry.arrived) this.entry = null
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

  private setPhase(phase: FilmPhase) {
    this.phase = phase
    this.onPhase(phase)
  }
}
