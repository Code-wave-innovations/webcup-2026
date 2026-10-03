import { gsap } from 'gsap'

/** What the atmospheric entry drives, every value 0 → 1. The stages read these, they no longer time anything. */
export interface EntryCues {
  /** the planet rushing to fill the canopy */
  rush: number
  /** cockpit shake */
  shake: number
  /** re-entry plasma around the ship (and its glow on Nova) */
  plasma: number
  /** radial speed blur */
  speedBlur: number
  /** warm white veil over the film */
  veil: number
  /** descent from the upper atmosphere to the city, already eased */
  arrival: number
  /** the cloud deck crossed just after the white-out: 0 above it → 1 below */
  clouds: number
}

/** Moments of the entry, in seconds from its start. */
export interface EntryMarks {
  /** the film cuts from the cockpit to the city, under the white veil */
  cut: number
  /** the city interface appears */
  arrive: number
  /** the camera has reached the flyover path */
  end: number
}

export interface EntryTimeline {
  readonly cues: EntryCues
  readonly marks: EntryMarks
  /** sets every cue to its value at `t` seconds (deterministic, any order) */
  seek(t: number): void
  kill(): void
}

export const restingCues = (): EntryCues => ({ rush: 0, shake: 0, plasma: 0, speedBlur: 0, veil: 0, arrival: 1, clouds: 1 })

const FULL: EntryMarks = { cut: 4.9, arrive: 7.4, end: 10.3 }
/** Reduced motion: a 0.6 s fade to white and back, no shake, plasma, blur nor flight. */
const REDUCED: EntryMarks = { cut: 0.6, arrive: 1.0, end: 1.2 }

/**
 * The atmospheric entry as one paused GSAP timeline over plain numbers: the director seeks it to the
 * entry's clock every frame, so pausing (`?fige`), skipping and jumping (`?entree=3`) are just seeks.
 *
 * 0.5 → 4.5 s the ship dives (planet rush, speed blur), 1 → 4 s it shakes, 2.4 → 4.3 s the plasma
 * envelops it, 4.2 → 4.9 s white-out; cut to the city; 4.9 → 6.4 s the white clears while the camera
 * falls through the cloud deck, then glides over the lake and the bridge until 10.3 s.
 */
export function createEntryTimeline(reducedMotion: boolean): EntryTimeline {
  const cues: EntryCues = { rush: 0, shake: 0, plasma: 0, speedBlur: 0, veil: 0, arrival: 0, clouds: 0 }
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  const marks = reducedMotion ? REDUCED : FULL

  if (reducedMotion) {
    timeline
      .to(cues, { veil: 1, duration: marks.cut, ease: 'sine.inOut' }, 0)
      .set(cues, { arrival: 1, clouds: 1 }, marks.cut)
      .to(cues, { veil: 0, duration: marks.end - marks.cut, ease: 'sine.inOut' }, marks.cut)
  } else {
    timeline
      .to(cues, { rush: 1, duration: 4, ease: 'power3.in' }, 0.5)
      .to(cues, { speedBlur: 1, duration: 2.1, ease: 'sine.inOut' }, 0.5)
      .to(cues, { speedBlur: 0, duration: 0.4, ease: 'power1.in' }, 4.5)
      .to(cues, { shake: 1, duration: 3, ease: 'sine.inOut' }, 1)
      .to(cues, { plasma: 1, duration: 1.9, ease: 'sine.inOut' }, 2.4)
      .to(cues, { veil: 1, duration: 0.7, ease: 'power2.in' }, 4.2)
      // the city: plasma and blur belong to the cockpit, the white clears as the clouds go by
      .set(cues, { plasma: 0, speedBlur: 0, shake: 0 }, marks.cut)
      .to(cues, { veil: 0, duration: 1.5, ease: 'power2.out' }, marks.cut)
      .to(cues, { clouds: 1, duration: 1.7, ease: 'power1.inOut' }, marks.cut)
      .to(cues, { arrival: 1, duration: marks.end - marks.cut, ease: 'power3.out' }, marks.cut)
  }
  // a last no-op so the timeline lasts until `end` whatever the tweens
  timeline.set({}, {}, marks.end)

  return {
    cues,
    marks,
    seek: (t) => void timeline.time(Math.max(0, t), true),
    kill: () => void timeline.kill(),
  }
}
