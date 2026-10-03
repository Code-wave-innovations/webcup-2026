import { create } from 'zustand'
import type { Emotion } from '../face/faceState'
import { INITIAL_BRAIN, reduceBrain, type BrainState, type Gesture, type Hold, type NovaIntent } from './novaBrain'

/** Nova's clock: wall time in seconds (the brain's timers do not follow the film's pauses). */
export const novaNow = () => performance.now() / 1000

/** Fast-changing perceptions, read every frame (not part of the brain's state). */
export const novaSignals = {
  /** loudness of what Nova hears: set to 1 on a keystroke, fades by itself */
  voice: 0,
}

/** Nova's state of mind, shared by the 3D body (read every frame) and the speech bubble. */
export const useNovaStore = create<{ brain: BrainState }>()(() => ({ brain: INITIAL_BRAIN }))

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
  /** something was typed: Nova's listening waveform reacts */
  hear: () => {
    novaSignals.voice = 1
  },
  reset: () => useNovaStore.setState({ brain: INITIAL_BRAIN }),
}
