import { describe, expect, it } from 'vitest'
import { LOCK_MS, MAX_ATTEMPTS } from './accessLock'
import { attemptsLeft, INITIAL_LOGIN, reduceLogin, type LoginEvent, type LoginState } from './loginMachine'

const run = (events: LoginEvent[], from: LoginState = INITIAL_LOGIN) => events.reduce(reduceLogin, from)
const refusal = (now = 1000): LoginEvent[] => [{ type: 'submit', complete: true, now }, { type: 'refused', now }]

describe('loginMachine', () => {
  it('asks for both fields before checking', () => {
    const state = run([{ type: 'submit', complete: false, now: 0 }])
    expect(state).toMatchObject({ status: 'editing', error: 'missing' })
    expect(run([{ type: 'edit' }], state).error).toBeNull()
  })

  it('checks once, then counts a refusal on the pips', () => {
    const checking = run([{ type: 'submit', complete: true, now: 0 }])
    expect(checking.status).toBe('checking')
    expect(run([{ type: 'submit', complete: true, now: 1 }], checking)).toBe(checking)
    const refused = run(refusal())
    expect(refused).toMatchObject({ status: 'refused', strikes: 1, error: 'refused' })
    expect(attemptsLeft(refused)).toBe(MAX_ATTEMPTS - 1)
    expect(run([{ type: 'edit' }], refused)).toMatchObject({ status: 'editing', strikes: 1, error: null })
  })

  it('locks after five refusals, refuses to check while locked, then reopens', () => {
    const locked = run(Array.from({ length: MAX_ATTEMPTS }, () => refusal()).flat())
    expect(locked).toMatchObject({ status: 'locked', strikes: MAX_ATTEMPTS, error: 'locked' })
    expect(run([{ type: 'submit', complete: true, now: 2000 }], locked).status).toBe('locked')
    expect(run([{ type: 'tick', now: 2000 }], locked)).toBe(locked)
    const open = run([{ type: 'tick', now: 1000 + LOCK_MS }], locked)
    expect(open).toMatchObject({ status: 'editing', strikes: 0, error: null })
    expect(run([{ type: 'submit', complete: true, now: 1000 + LOCK_MS }], open).status).toBe('checking')
  })

  it('goes back to editing without a strike when the check cannot decide', () => {
    const struck = run(refusal())
    const undecided = run([{ type: 'submit', complete: true, now: 2000 }, { type: 'inconclusive' }], struck)
    expect(undecided).toMatchObject({ status: 'editing', strikes: 1, error: null })
    expect(undecided.lock).toBe(struck.lock)
    expect(run([{ type: 'inconclusive' }], struck)).toBe(struck)
  })

  it('stays granted whatever happens next', () => {
    const granted = run([{ type: 'submit', complete: true, now: 0 }, { type: 'granted' }])
    expect(granted.status).toBe('granted')
    expect(run([{ type: 'refused', now: 1 }], granted)).toBe(granted)
  })
})
