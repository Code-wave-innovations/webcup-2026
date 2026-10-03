export const MAX_ATTEMPTS = 5
export const LOCK_MS = 30_000

/** Failed attempts at the airlock: after five, it locks for thirty seconds. */
export interface AccessLock {
  failures: number
  lockedUntil: number
}

export const OPEN_LOCK: AccessLock = { failures: 0, lockedUntil: 0 }

/** Whole seconds left before a new attempt is allowed (0 when open). */
export function lockSecondsLeft(lock: AccessLock, now: number): number {
  return Math.max(0, Math.ceil((lock.lockedUntil - now) / 1000))
}

/** Counts a refused attempt; the fifth one locks the airlock and resets the count. */
export function registerFailure(lock: AccessLock, now: number): { lock: AccessLock; attempt: number; lockedNow: boolean } {
  const attempt = lock.failures + 1
  if (attempt >= MAX_ATTEMPTS) return { lock: { failures: 0, lockedUntil: now + LOCK_MS }, attempt, lockedNow: true }
  return { lock: { ...lock, failures: attempt }, attempt, lockedNow: false }
}
