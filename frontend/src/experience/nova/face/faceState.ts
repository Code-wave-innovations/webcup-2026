/** Feelings Nova shows on its face. */
export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'denied' | 'alarmed' | 'focused'

export const EMOTIONS: readonly Emotion[] = ['neutral', 'happy', 'sad', 'surprised', 'denied', 'alarmed', 'focused']

/** What the face shows this frame, whatever draws it (visor shader, morph targets, eye meshes). */
export interface FaceState {
  /** per eye, 0 closed → 1 open (blinks and hidden eyes included) */
  eyeOpen: [number, number]
  /** gaze offset, -1 → 1 on each axis */
  look: { x: number; y: number }
  happy: number
  sad: number
  angry: number
  surprised: number
  smile: number
  /** speaking mouth openness */
  mouth: number
  thinking: number
  listening: number
  /** loudness of what Nova hears (typing), for the listening waveform */
  voice: number
  /** red tint of alarm and refusal */
  alert: number
}

export function createFaceState(): FaceState {
  return { eyeOpen: [1, 1], look: { x: 0, y: 0 }, happy: 0, sad: 0, angry: 0, surprised: 0, smile: 0.35, mouth: 0, thinking: 0, listening: 0, voice: 0, alert: 0 }
}

type ExpressionTarget = Pick<FaceState, 'happy' | 'sad' | 'angry' | 'surprised' | 'smile' | 'alert'>

const BASE: ExpressionTarget = { happy: 0, sad: 0, angry: 0, surprised: 0, smile: 0, alert: 0 }

export const EXPRESSIONS: Record<Emotion, ExpressionTarget> = {
  neutral: { ...BASE, smile: 0.35 },
  happy: { ...BASE, happy: 1, smile: 1 },
  sad: { ...BASE, sad: 1 },
  surprised: { ...BASE, surprised: 1 },
  denied: { ...BASE, angry: 1, alert: 0.85 },
  alarmed: { ...BASE, surprised: 0.7, alert: 1 },
  focused: { ...BASE, angry: 0.3 },
}
