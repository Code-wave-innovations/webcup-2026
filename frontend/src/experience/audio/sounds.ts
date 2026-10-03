import type { FlightPhase } from '../city/explore/flightPath'
import type { BrainState, Gesture, Hold } from '../nova/behavior/novaBrain'
import type { Emotion } from '../nova/face/faceState'

/**
 * The score of every sound, as plain data: the engine only renders it. Nothing is a file, everything
 * is synthesized, so the whole sound design weighs a few kilobytes and stays testable.
 */

/** A tone: an oscillator gliding from `freq` to `to` (Hz), with a short attack and an exponential release. */
export interface Tone {
  kind: 'tone'
  /** start, in seconds after the cue is played */
  at: number
  dur: number
  freq: number
  to?: number
  wave: OscillatorType
  gain: number
}

/** A burst of filtered noise (clicks, breaths, whooshes): the band-pass centre glides from `freq` to `to`. */
export interface Hiss {
  kind: 'hiss'
  at: number
  dur: number
  freq: number
  to?: number
  q: number
  gain: number
}

export type Note = Tone | Hiss

/** Interface and story sounds, independent of Nova's mood. */
export type Cue = 'tap' | 'hover' | 'key' | 'granted' | 'refused' | 'locked' | 'alarm' | 'whoosh' | 'hop' | 'giggle'

const tone = (at: number, dur: number, freq: number, gain: number, wave: OscillatorType = 'sine', to?: number): Tone => ({ kind: 'tone', at, dur, freq, to, wave, gain })
const hiss = (at: number, dur: number, freq: number, gain: number, q = 1, to?: number): Hiss => ({ kind: 'hiss', at, dur, freq, to, q, gain })

export const CUES: Record<Cue, readonly Note[]> = {
  // a glass tick, under the threshold of annoyance
  tap: [tone(0, 0.05, 1760, 0.16, 'sine', 1180), hiss(0, 0.02, 5200, 0.05, 3)],
  hover: [tone(0, 0.03, 2640, 0.04, 'sine', 2400)],
  key: [hiss(0, 0.018, 3400, 0.09, 4)],
  // access granted: an ice-bright major arpeggio with a high shimmer
  granted: [
    tone(0, 0.22, 523.25, 0.16, 'triangle'),
    tone(0.09, 0.22, 659.25, 0.16, 'triangle'),
    tone(0.18, 0.5, 783.99, 0.16, 'triangle'),
    tone(0.27, 0.7, 1046.5, 0.1, 'sine'),
    hiss(0.27, 0.6, 7000, 0.04, 2, 9000),
  ],
  // refused: two falling buzzes, muffled
  refused: [tone(0, 0.13, 220, 0.12, 'square', 200), tone(0.15, 0.2, 185, 0.12, 'square', 160)],
  // locked: a heavy bolt
  locked: [tone(0, 0.35, 90, 0.3, 'sine', 48), hiss(0, 0.08, 900, 0.12, 1.4, 300)],
  alarm: [0, 0.5, 1].flatMap((at) => [tone(at, 0.22, 880, 0.08, 'sawtooth'), tone(at + 0.22, 0.22, 660, 0.08, 'sawtooth')]),
  whoosh: [hiss(0, 0.7, 400, 0.14, 0.8, 2400)],
  hop: [tone(0, 0.16, 330, 0.12, 'sine', 880)],
  giggle: [0, 0.06, 0.12, 0.18].map((at, i) => tone(at, 0.05, 1200 + i * 140, 0.08, 'sine', 1500 + i * 140)),
}

/** Each mood speaks in its own register: base pitch (Hz), spread, and the melodic contour of a chirp. */
const VOICES: Record<
  Emotion,
  {
    base: number
    spread: number
    contour: readonly number[]
    wave: OscillatorType
  }
> = {
  neutral: { base: 620, spread: 0.18, contour: [0, 0.15, 0.05], wave: 'sine' },
  happy: { base: 760, spread: 0.25, contour: [0, 0.3, 0.55], wave: 'sine' },
  sad: {
    base: 430,
    spread: 0.1,
    contour: [0.1, -0.05, -0.25],
    wave: 'triangle',
  },
  surprised: { base: 700, spread: 0.2, contour: [0, 0.7], wave: 'sine' },
  denied: { base: 380, spread: 0.08, contour: [0, -0.2], wave: 'triangle' },
  alarmed: {
    base: 900,
    spread: 0.12,
    contour: [0, -0.1, 0, -0.1],
    wave: 'square',
  },
  focused: { base: 540, spread: 0.06, contour: [0, 0], wave: 'triangle' },
}

/** Nova's little "word" for a mood: a few gliding blips that rise when happy and sag when sad. */
export function chirp(emotion: Emotion, random: () => number): Tone[] {
  const voice = VOICES[emotion]
  const step = 0.075
  return voice.contour.map((rise, i) => {
    const freq = voice.base * (1 + rise) * (1 + (random() - 0.5) * voice.spread * 0.4)
    const next = voice.contour[i + 1] ?? rise + (rise >= 0 ? 0.08 : -0.08)
    return tone(i * step, step * 1.1, freq, 0.07, voice.wave, voice.base * (1 + next))
  })
}

/** One syllable of Nova talking: a short blip somewhere in the mood's register (the speech murmurs). */
export function syllable(emotion: Emotion, random: () => number): Tone {
  const voice = VOICES[emotion]
  const freq = voice.base * (0.85 + random() * (0.3 + voice.spread))
  return tone(0, 0.05 + random() * 0.03, freq, 0.035, voice.wave, freq * (0.92 + random() * 0.16))
}

/** Seconds of silence before the next syllable: words of 2–4 blips separated by short pauses. */
export function syllableGap(random: () => number): number {
  return random() < 0.22 ? 0.16 + random() * 0.08 : 0.07 + random() * 0.04
}

/** What Nova's change of state sounds like: a story cue, or one of its chirps. */
export type Reaction = { cue: Cue } | { chirp: Emotion }

const GESTURE_SOUNDS: Record<Gesture, readonly Reaction[]> = {
  wave: [{ chirp: 'happy' }],
  celebrate: [{ cue: 'granted' }],
  refuse: [{ cue: 'refused' }, { chirp: 'denied' }],
  point: [{ chirp: 'neutral' }],
  poked: [{ cue: 'giggle' }],
  hop: [{ cue: 'hop' }],
  land: [{ cue: 'locked' }],
}
const HOLD_SOUNDS: Partial<Record<Hold, readonly Reaction[]>> = {
  sulk: [{ cue: 'locked' }],
  coverEyes: [{ chirp: 'surprised' }],
  think: [{ chirp: 'focused' }],
  brace: [{ cue: 'whoosh' }],
}

/** Pure: the sounds triggered between two of Nova's states of mind (new gesture, new posture, new line, alert). */
export function reactionSounds(prev: BrainState, next: BrainState): Reaction[] {
  const out: Reaction[] = []
  if (next.gesture && next.gesture.id !== prev.gesture?.id) out.push(...GESTURE_SOUNDS[next.gesture.name])
  for (const hold of next.holds) if (!prev.holds.includes(hold)) out.push(...(HOLD_SOUNDS[hold] ?? []))
  // a line that starts with a gesture already has its sound
  if (next.speech && next.speech.id !== prev.speech?.id && !out.length) out.push({ chirp: next.speech.emotion })
  if (next.alert && !prev.alert) out.push({ cue: 'alarm' })
  return out
}

/** Levels (0 → 1) and filter openings of the ambience beds while Nova flies. */
export interface FlightMix {
  wind: number
  windTone: number
  rumble: number
  rumbleTone: number
}

/** Thrust under the wind: a charging hum while crouching, a roar at take-off, rushing air with speed. */
export function flightMix(phase: FlightPhase, speed: number): FlightMix {
  switch (phase) {
    case 'crouch':
      return { wind: 0.22, windTone: 0, rumble: 0.2, rumbleTone: 0 }
    case 'takeoff':
      return { wind: 0.3 + speed * 0.7, windTone: speed, rumble: 0.55 + speed * 0.4, rumbleTone: 0.3 + speed * 0.5 }
    case 'cruise':
      return { wind: 0.4 + speed * 0.6, windTone: speed, rumble: 0.3 + speed * 0.3, rumbleTone: 0.5 }
    case 'flare':
      return { wind: 0.3 + speed * 0.5, windTone: speed * 0.7, rumble: 0.5, rumbleTone: 0.4 }
    case 'landing':
      return { wind: 0.22 + speed * 0.4, windTone: speed * 0.5, rumble: speed * 0.4, rumbleTone: 0.2 }
  }
}

/** A whoosh when Nova leaves the ground and when it brakes before landing (touchdown is the 'land' gesture). */
export function flightCue(prev: FlightPhase | null, next: FlightPhase | null): Cue | null {
  if (next === prev) return null
  return next === 'takeoff' || next === 'flare' ? 'whoosh' : null
}
