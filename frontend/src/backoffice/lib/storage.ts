import { useState } from 'react'

/*
  Per-browser preferences of the back-office (chosen view, last wave seen…). Storage can be
  missing or throw (private window, blocked site data): every access falls back silently.
*/

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // the choice simply won't survive a reload
  }
}

/** A string choice among `allowed`, kept in localStorage. */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readPref(key)
    return allowed.includes(stored as T) ? (stored as T) : fallback
  })
  const update = (next: T) => {
    setValue(next)
    writePref(key, next)
  }
  return [value, update] as const
}
