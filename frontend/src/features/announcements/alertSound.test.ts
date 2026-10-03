import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDirectorStore } from '../../experience/director/directorStore'
import { bindCityAlertSound, createAlertChime, type ChimeNote, type ToneClock } from './alertSound'

function fakeClock() {
  const notes: ChimeNote[] = []
  let cancelled = 0
  let resumed = 0
  const clock: ToneClock = {
    now: () => 0,
    resume: () => {
      resumed += 1
    },
    note: (note) => {
      notes.push(note)
    },
    cancel: () => {
      cancelled += 1
    },
  }
  return {
    clock,
    notes,
    get cancelled() {
      return cancelled
    },
    get resumed() {
      return resumed
    },
  }
}

describe('createAlertChime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays a short ice phrase, reprises it softly, and stops when asked', () => {
    vi.useFakeTimers()
    const audio = fakeClock()
    const chime = createAlertChime(audio.clock)
    chime.start()
    chime.start()
    expect(audio.resumed).toBe(1)
    expect(audio.notes.map((note) => note.freq)).toEqual([220, 440, 523.25, 659.25, 880])
    expect(audio.notes[1].peak).toBeGreaterThan(audio.notes[0].peak)

    vi.advanceTimersByTime(16_000)
    expect(audio.notes).toHaveLength(10)
    expect(audio.notes[6].peak).toBeLessThan(audio.notes[1].peak)

    chime.stop()
    const frozen = audio.notes.length
    vi.advanceTimersByTime(32_000)
    expect(audio.notes).toHaveLength(frozen)
    expect(audio.cancelled).toBe(1)
  })

  it('plays the phrase once when motion is reduced', () => {
    vi.useFakeTimers()
    const audio = fakeClock()
    const chime = createAlertChime(audio.clock, () => true)
    chime.start()
    expect(audio.notes).toHaveLength(5)
    vi.advanceTimersByTime(40_000)
    expect(audio.notes).toHaveLength(5)
    chime.stop()
  })
})

describe('bindCityAlertSound', () => {
  afterEach(() => {
    useDirectorStore.setState({ alert: false })
    vi.useRealTimers()
  })

  it('starts with the city alert and cuts the chime when the alert is lifted', () => {
    vi.useFakeTimers()
    const audio = fakeClock()
    const release = bindCityAlertSound(audio.clock)
    expect(audio.notes).toHaveLength(0)

    useDirectorStore.getState().setAlert(true)
    expect(audio.notes).toHaveLength(5)

    useDirectorStore.getState().setAlert(false)
    expect(audio.cancelled).toBe(1)
    const frozen = audio.notes.length
    vi.advanceTimersByTime(32_000)
    expect(audio.notes).toHaveLength(frozen)

    release()
  })
})
