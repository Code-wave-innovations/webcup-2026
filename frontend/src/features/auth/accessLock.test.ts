import { describe, expect, it } from 'vitest'
import { LOCK_MS, OPEN_LOCK, lockSecondsLeft, registerFailure } from './accessLock'

describe('accessLock', () => {
  it('counts refused attempts without locking before the fifth', () => {
    let lock = OPEN_LOCK
    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = registerFailure(lock, 1000)
      expect(result.attempt).toBe(attempt)
      expect(result.lockedNow).toBe(false)
      lock = result.lock
    }
    expect(lockSecondsLeft(lock, 1000)).toBe(0)
  })

  it('locks for thirty seconds on the fifth refusal and resets the count', () => {
    const lock = { failures: 4, lockedUntil: 0 }
    const result = registerFailure(lock, 1000)
    expect(result.lockedNow).toBe(true)
    expect(result.lock).toEqual({ failures: 0, lockedUntil: 1000 + LOCK_MS })
    expect(lockSecondsLeft(result.lock, 1000)).toBe(30)
    expect(lockSecondsLeft(result.lock, 1000 + LOCK_MS - 1500)).toBe(2)
    expect(lockSecondsLeft(result.lock, 1000 + LOCK_MS)).toBe(0)
  })
})
