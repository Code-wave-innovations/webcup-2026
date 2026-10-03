import { create } from 'zustand'
import type { Emotion } from '../face/faceState'
import { pickQuip } from './quips'
import { INITIAL_BRAIN, reduceBrain, type BrainState, type Gesture, type Hold, type NovaIntent } from './novaBrain'

/** Nova's clock: wall time in seconds (the brain's timers do not follow the film's pauses). */
export const novaNow = () => performance.now() / 1000

/** Fast-changing perceptions, read every frame (not part of the brain's state). */
export const novaSignals = {
  /** loudness of what Nova hears: set to 1 on a keystroke, fades by itself */
  voice: 0,
  /** the pointer is over Nova: head tilted, eyes wide */
  curious: false,
  /** centre of the control Nova looks at (hovered or focused call to action), in CSS pixels; null: the cursor */
  focus: null as { x: number; y: number } | null,
  /** a brief look somewhere else (the district it is about to point at), until `until` on Nova's clock */
  glance: null as { x: number; y: number; until: number } | null,
  /** how fast Nova travels, in its own heights per second: the walk cycle keeps pace so the feet never slide */
  pace: 0,
  /** steps aside from its spot on the stage, in its own heights (+: towards the right of the screen); it walks there */
  shift: 0,
  /** the camera pulls focus onto Nova until then (Nova's clock): a strong reaction takes the stage */
  spotlightUntil: 0,
}

/** Nova's state of mind, shared by the 3D body (read every frame) and the speech bubble. */
export const useNovaStore = create<{ brain: BrainState }>()(() => ({ brain: INITIAL_BRAIN }))

// dev tooling: read Nova's state of mind from the console or a test driver
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __novaStore: useNovaStore })

export function tellNova(intent: NovaIntent): void {
  useNovaStore.setState((s) => ({ brain: reduceBrain(s.brain, intent, novaNow()) }))
}

/** What the interface can ask of Nova. */
export const nova = {
  gesture: (gesture: Gesture) => tellNova({ type: 'gesture', gesture }),
  hold: (hold: Hold, on: boolean) => tellNova({ type: 'hold', hold, on }),
  emote: (emotion: Emotion, seconds?: number) => tellNova({ type: 'emote', emotion, seconds }),
  say: (text: string, emotion?: Emotion) => tellNova({ type: 'say', text, emotion }),
  silence: () => tellNova({ type: 'silence' }),
  alert: (on: boolean) => tellNova({ type: 'alert', on }),
  walk: (on: boolean) => tellNova({ type: 'walk', on }),
  talk: (on: boolean) => tellNova({ type: 'talk', on }),
  /** the visitor clicked Nova: a little jolt and a line */
  poke: () => {
    tellNova({ type: 'gesture', gesture: 'poked' })
    tellNova({ type: 'say', text: pickQuip(), emotion: 'happy' })
  },
  /** the camera racks focus onto Nova for a moment */
  spotlight: (seconds: number) => {
    novaSignals.spotlightUntil = Math.max(novaSignals.spotlightUntil, novaNow() + seconds)
  },
  /** something was typed: Nova's listening waveform reacts */
  hear: () => {
    novaSignals.voice = 1
  },
  reset: () => useNovaStore.setState({ brain: INITIAL_BRAIN }),
}
