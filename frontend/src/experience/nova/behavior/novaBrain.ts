import type { Emotion } from '../face/faceState'
import type { ClipName } from '../rig/rigContract'

/** One-shot moves: they play once, then Nova goes back to what it was doing. */
export type Gesture = 'wave' | 'celebrate' | 'refuse' | 'point' | 'poked' | 'hop' | 'land'
/** Postures held until released (the password field keeps the hands on the eyes…). */
export type Hold = 'fly' | 'crouch' | 'brace' | 'coverEyes' | 'peek' | 'think' | 'sulk' | 'listen' | 'present'

/** What the rest of the application asks of Nova. */
export type NovaIntent =
  | { type: 'gesture'; gesture: Gesture }
  | { type: 'gestureEnded'; id: number }
  | { type: 'hold'; hold: Hold; on: boolean }
  | { type: 'emote'; emotion: Emotion; seconds?: number }
  | { type: 'say'; text: string; emotion?: Emotion }
  | { type: 'silence' }
  | { type: 'alert'; on: boolean }
  | { type: 'walk'; on: boolean }
  /** Nova speaks without its bubble (the words go elsewhere: the chat) */
  | { type: 'talk'; on: boolean }

export interface Speech {
  id: number
  text: string
  emotion: Emotion
  started: number
  /** characters revealed per second (the bubble types, the mouth follows) */
  rate: number
}

export interface BrainState {
  emotion: Emotion
  emotionUntil: number
  gesture: { name: Gesture; id: number; started: number } | null
  holds: Hold[]
  speech: Speech | null
  alert: boolean
  walking: boolean
  /** talking outside the bubble (a chat reply streaming in) */
  talking: boolean
  nextId: number
}

export const INITIAL_BRAIN: BrainState = {
  emotion: 'neutral',
  emotionUntil: 0,
  gesture: null,
  holds: [],
  speech: null,
  alert: false,
  walking: false,
  talking: false,
  nextId: 1,
}

/** Most important posture first: flying beats everything, bracing for the entry beats hiding the eyes, which beats thinking… */
const HOLD_PRIORITY: readonly Hold[] = ['fly', 'crouch', 'brace', 'coverEyes', 'peek', 'think', 'sulk', 'listen', 'present']

const GESTURE_CLIP: Record<Gesture, ClipName> = { wave: 'wave', celebrate: 'celebrate', refuse: 'shakeHead', point: 'point', poked: 'poked', hop: 'hop', land: 'land' }
const GESTURE_FEELING: Partial<Record<Gesture, readonly [Emotion, number]>> = {
  wave: ['happy', 2.2],
  celebrate: ['happy', 3],
  refuse: ['denied', 2.2],
  poked: ['happy', 1.6],
  hop: ['surprised', 1.1],
  land: ['focused', 1.6],
}
/** A gesture that never reports its end (interrupted clip, missing event) is dropped after this. */
const GESTURE_TIMEOUT = 5
export const SPEECH_RATE = 31
/** The bubble stays readable this long after the last character. */
export const SPEECH_LINGER = 3.5

export function speechDuration(speech: Speech): number {
  return speech.text.length / speech.rate
}

/** Characters of the speech revealed at `now`, and whether Nova is still talking. */
export function speechProgress(speech: Speech | null, now: number): { shown: number; talking: boolean; visible: boolean } {
  if (!speech) return { shown: 0, talking: false, visible: false }
  const elapsed = now - speech.started
  const shown = Math.min(speech.text.length, Math.max(0, Math.floor(elapsed * speech.rate)))
  return { shown, talking: shown < speech.text.length, visible: elapsed < speechDuration(speech) + SPEECH_LINGER }
}

function feel(state: BrainState, emotion: Emotion, seconds: number, now: number): BrainState {
  return { ...state, emotion, emotionUntil: now + seconds }
}

/** Pure transition: how an intent changes Nova's state of mind. */
export function reduceBrain(state: BrainState, intent: NovaIntent, now: number): BrainState {
  switch (intent.type) {
    case 'gesture': {
      const next = { ...state, gesture: { name: intent.gesture, id: state.nextId, started: now }, nextId: state.nextId + 1 }
      const feeling = GESTURE_FEELING[intent.gesture]
      return feeling ? feel(next, feeling[0], feeling[1], now) : next
    }
    case 'gestureEnded':
      return state.gesture?.id === intent.id ? { ...state, gesture: null } : state
    case 'hold': {
      const holds = state.holds.filter((h) => h !== intent.hold)
      return { ...state, holds: intent.on ? [...holds, intent.hold] : holds }
    }
    case 'emote':
      return feel(state, intent.emotion, intent.seconds ?? 2.5, now)
    case 'say':
      return { ...state, speech: { id: state.nextId, text: intent.text, emotion: intent.emotion ?? 'neutral', started: now, rate: SPEECH_RATE }, nextId: state.nextId + 1 }
    case 'silence':
      return { ...state, speech: null }
    case 'alert':
      return { ...state, alert: intent.on }
    case 'walk':
      return { ...state, walking: intent.on }
    case 'talk':
      return { ...state, talking: intent.on }
  }
}

/** What Nova's body and face do at a given instant. */
export interface NovaPose {
  clip: ClipName
  /** plays once and reports its end (gestures) */
  once: boolean
  /** restarts the clip when the same gesture is asked again */
  key: number
  emotion: Emotion
  /** head follows the look target; off while a clip moves the head on purpose */
  lookAtTarget: boolean
  /** look up and aside (thinking) */
  lookUp: boolean
  eyesHidden: 'none' | 'both' | 'peek'
  thinking: boolean
  listening: boolean
  talking: boolean
  /** feet off the ground, hovering (not while walking, jumping or bracing) */
  floating: boolean
}

/** clips that move the head on purpose (the look at the visitor stays off) */
const NO_LOOK: readonly ClipName[] = ['shakeHead', 'coverEyes', 'peek', 'brace', 'think', 'crouch', 'fly', 'land']
/** clips with the feet on the ground, or flying (no hovering bob) */
const GROUNDED: readonly ClipName[] = ['walk', 'celebrate', 'brace', 'poked', 'hop', 'crouch', 'fly', 'land']

export function topHold(holds: readonly Hold[]): Hold | null {
  return HOLD_PRIORITY.find((h) => holds.includes(h)) ?? null
}

/** Pure selector: the pose that follows from the state at `now` (priority: gesture, posture, walk, speech, idle). */
export function resolvePose(state: BrainState, now: number): NovaPose {
  const gesture = state.gesture && now - state.gesture.started < GESTURE_TIMEOUT ? state.gesture : null
  const hold = topHold(state.holds)
  const speech = speechProgress(state.speech, now)
  const talking = speech.talking || state.talking

  let clip: ClipName = 'idle'
  let key = 0
  if (gesture) {
    clip = GESTURE_CLIP[gesture.name]
    key = gesture.id
  } else if (hold && !(hold === 'present' && state.walking)) clip = hold
  else if (state.walking) clip = 'walk'
  else if (talking) clip = 'talk'

  let emotion: Emotion = 'neutral'
  if (now < state.emotionUntil) emotion = state.emotion
  else if (state.alert) emotion = 'alarmed'
  else if (speech.visible && state.speech) emotion = state.speech.emotion
  else if (hold === 'brace' || hold === 'fly' || hold === 'crouch') emotion = 'focused'

  return {
    clip,
    once: !!gesture,
    key,
    emotion,
    lookAtTarget: !NO_LOOK.includes(clip),
    lookUp: clip === 'think',
    eyesHidden: clip === 'coverEyes' ? 'both' : clip === 'peek' ? 'peek' : 'none',
    thinking: hold === 'think',
    listening: hold === 'listen',
    talking,
    floating: !GROUNDED.includes(clip),
  }
}
