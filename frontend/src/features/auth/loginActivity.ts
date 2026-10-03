import type { Inconclusive } from './authService'

/** A point on screen, in CSS pixels. */
export interface ScreenPoint {
  x: number
  y: number
}

export type LoginField = 'identifier' | 'code'

/**
 * What happens at the access control, as it happens. The hologram publishes it and does not care who
 * listens (the airlock page makes Nova react to it).
 */
export type LoginActivity =
  /** a field gained the focus, or none has it any more */
  | { type: 'focus'; field: LoginField | null }
  /** a character was typed or the caret moved; `caret` is where it is on screen (identifier only) */
  | { type: 'typing'; field: LoginField; caret: ScreenPoint | null }
  | { type: 'identifierValid'; valid: boolean }
  /** the access code is shown in clear, or hidden again */
  | { type: 'reveal'; shown: boolean }
  /** caps lock while typing the code; `hint` is the warning under the field */
  | { type: 'capsLock'; on: boolean; hint: ScreenPoint | null }
  | { type: 'checking' }
  | { type: 'refused'; attempt: number; left: number }
  | { type: 'locked'; seconds: number }
  | { type: 'unlocked' }
  | { type: 'granted'; name: string }
  /** the face scanner is open and looking for a face (`lens` is the camera circle on screen), or closed */
  | { type: 'faceScan'; open: boolean; lens: ScreenPoint | null }
  /** the face engine could not grant access: unknown face, no usable face, or no service */
  | { type: 'faceUndecided'; reason: Inconclusive }
  /** a face was linked to the account that just signed in */
  | { type: 'faceLinked'; name: string }
