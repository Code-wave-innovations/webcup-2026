import { lockSecondsLeft, MAX_ATTEMPTS, OPEN_LOCK, registerFailure, type AccessLock } from './accessLock'

export type LoginStatus = 'editing' | 'checking' | 'refused' | 'locked' | 'granted'

export type LoginError = 'missing' | 'refused' | 'locked'

export interface LoginState {
  status: LoginStatus
  lock: AccessLock
  /** refused attempts shown on the hologram's pips (all five while locked) */
  strikes: number
  error: LoginError | null
}

export type LoginEvent =
  | { type: 'submit'; complete: boolean; now: number }
  | { type: 'refused'; now: number }
  | { type: 'granted' }
  /** the check could not decide (e.g. no face in the frame): back to editing, no attempt counted */
  | { type: 'inconclusive' }
  | { type: 'edit' }
  /** the clock moved on: lifts an expired lock */
  | { type: 'tick'; now: number }

export const INITIAL_LOGIN: LoginState = { status: 'editing', lock: OPEN_LOCK, strikes: 0, error: null }

/** Pure transitions of the airlock's access control: check, refusal, lock after five refusals, access. */
export function reduceLogin(state: LoginState, event: LoginEvent): LoginState {
  if (state.status === 'granted') return state
  switch (event.type) {
    case 'submit':
      if (state.status === 'checking') return state
      if (lockSecondsLeft(state.lock, event.now) > 0) return { ...state, status: 'locked', error: 'locked' }
      if (!event.complete) return { ...state, status: 'editing', error: 'missing' }
      return { ...state, status: 'checking', error: null }
    case 'refused': {
      const failure = registerFailure(state.lock, event.now)
      return failure.lockedNow
        ? { status: 'locked', lock: failure.lock, strikes: MAX_ATTEMPTS, error: 'locked' }
        : { status: 'refused', lock: failure.lock, strikes: failure.attempt, error: 'refused' }
    }
    case 'granted':
      return { ...state, status: 'granted', lock: OPEN_LOCK, error: null }
    case 'inconclusive':
      return state.status === 'checking' ? { ...state, status: 'editing', error: null } : state
    case 'edit':
      return state.status === 'refused' || state.error === 'missing' ? { ...state, status: 'editing', error: null } : state
    case 'tick':
      return state.status === 'locked' && lockSecondsLeft(state.lock, event.now) === 0 ? { ...state, status: 'editing', strikes: 0, error: null } : state
  }
}

/** Attempts left before the airlock locks. */
export const attemptsLeft = (state: LoginState) => MAX_ATTEMPTS - state.lock.failures
