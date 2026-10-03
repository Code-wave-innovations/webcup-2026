import type { Camera } from 'three'
import { clamp } from '../../lib/math'
import { LAST_POSE } from '../city/cameraPath'
import { createFilmControls } from '../post/FilmEffect'
import { debugParams } from './debugParams'
import type { FilmPhase } from './directorStore'
import { createEntryTimeline, restingCues, type EntryTimeline } from './timelines/entryTimeline'

export type Stage = 'space' | 'city'

const OPENING_SECONDS = 1.8
/** the camera rises from the flyover to the Observatory's balcony (the chat) */
const OBSERVATORY_SECONDS = 1.6
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
  readonly pointer = { x: 0, y: 0 }
  readonly pointerSmooth = { x: 0, y: 0 }

  private opening = 0
  private observatoryGoal = 0
  private observatoryClock = 0
  private returning: { t: number; switched: boolean } | null = null
  private readonly onPhase: (phase: FilmPhase) => void

  constructor(onPhase: (phase: FilmPhase) => void, reducedMotion: boolean) {
    this.onPhase = onPhase
    this.reducedMotion = reducedMotion
  }

  /** descent progress (eased), 1 once the camera has reached the flyover path */
  get arrival(): number {
    return this.cues.arrival
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
    this.observatoryGoal = this.observatoryClock = this.observatory = 0
    if (!this.returning) this.returning = { t: 0, switched: false }
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

  private setPhase(phase: FilmPhase) {
    this.phase = phase
    this.onPhase(phase)
  }
}
