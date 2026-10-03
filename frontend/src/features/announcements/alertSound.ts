import { useDirectorStore } from '../../experience/director/directorStore'
import { matchesQuery, REDUCED_MOTION_QUERY } from '../../hooks/useMediaQuery'

/** One glass tone of the alert chime. Times are seconds on the audio clock. */
export interface ChimeNote {
  freq: number
  start: number
  duration: number
  peak: number
}

/** Clock the chime schedules onto. The browser one is Web Audio; tests pass a fake. */
export interface ToneClock {
  now(): number
  resume(): void
  note(note: ChimeNote): void
  cancel(): void
}

/**
 * A small open phrase in A minor: the ice light of the interface, with a low warm tone under it
 * for the sunset city. Quiet on purpose, so an alert can stay up without wearing anyone out.
 */
const MOTIF: readonly Omit<ChimeNote, 'start'>[] = [
  { freq: 220, duration: 2.6, peak: 0.04 },
  { freq: 440, duration: 1.7, peak: 0.07 },
  { freq: 523.25, duration: 1.55, peak: 0.06 },
  { freq: 659.25, duration: 1.45, peak: 0.055 },
  { freq: 880, duration: 1.7, peak: 0.035 },
]

const STAGGER = [0, 0.05, 0.32, 0.58, 0.9]
const REPRISE_MS = 16_000

export function createAlertChime(clock: ToneClock, isReduced: () => boolean = () => false) {
  let playing = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const playMotif = (scale: number) => {
    const t = clock.now() + 0.04
    MOTIF.forEach((note, index) => {
      clock.note({ freq: note.freq, start: t + STAGGER[index], duration: note.duration, peak: note.peak * scale })
    })
  }

  const reprise = () => {
    if (!playing) return
    playMotif(0.7)
    timer = setTimeout(reprise, REPRISE_MS)
  }

  return {
    start() {
      if (playing) return
      playing = true
      clock.resume()
      playMotif(1)
      if (!isReduced()) timer = setTimeout(reprise, REPRISE_MS)
    },
    stop() {
      if (!playing) return
      playing = false
      clearTimeout(timer)
      timer = undefined
      clock.cancel()
    },
  }
}

/** Soft futuristic chime while the city alert is up. Once only when motion is reduced. */
export function bindCityAlertSound(clock: ToneClock = createWebAudioClock(), isReduced: () => boolean = () => matchesQuery(REDUCED_MOTION_QUERY)): () => void {
  const chime = createAlertChime(clock, isReduced)
  const sync = (on: boolean) => (on ? chime.start() : chime.stop())
  sync(useDirectorStore.getState().alert)
  const unsub = useDirectorStore.subscribe((state, prev) => {
    if (state.alert !== prev.alert) sync(state.alert)
  })
  return () => {
    unsub()
    chime.stop()
  }
}

function createWebAudioClock(): ToneClock {
  let ctx: AudioContext | null = null
  let bus: GainNode | null = null
  const live: OscillatorNode[] = []
  let unlockArmed = false

  const context = () => {
    if (ctx) return ctx
    const Ctor = audioContextCtor()
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  }

  const armUnlock = (c: AudioContext) => {
    if (unlockArmed || typeof document === 'undefined') return
    unlockArmed = true
    const unlock = () => {
      if (c.state === 'suspended') void c.resume()
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
  }

  const output = () => {
    const c = context()
    if (!c) return null
    if (bus) return bus
    const master = c.createGain()
    master.gain.value = 0.9
    const wet = c.createGain()
    wet.gain.value = 0.28
    const delay = c.createDelay(1)
    delay.delayTime.value = 0.21
    const feedback = c.createGain()
    feedback.gain.value = 0.18
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3200
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    filter.connect(master)
    filter.connect(delay)
    wet.connect(master)
    master.connect(c.destination)
    bus = filter
    return bus
  }

  return {
    now: () => context()?.currentTime ?? 0,
    resume() {
      const c = context()
      if (!c || c.state === 'running') return
      void c.resume().then(() => {
        if (c.state === 'suspended') armUnlock(c)
      })
    },
    note({ freq, start, duration, peak }) {
      const c = context()
      const dest = output()
      if (!c || !dest) return
      const gain = c.createGain()
      const end = start + duration
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      gain.connect(dest)
      // Fundamental plus a faint upper partial, so the tone reads as glass rather than a plain beep.
      for (const [ratio, level] of [
        [1, 1],
        [2.01, 0.16],
      ] as const) {
        if (ratio > 1 && freq < 300) continue
        const osc = c.createOscillator()
        const partial = c.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq * ratio
        partial.gain.value = level
        osc.connect(partial)
        partial.connect(gain)
        osc.start(start)
        osc.stop(end + 0.02)
        live.push(osc)
        osc.onended = () => {
          const index = live.indexOf(osc)
          if (index >= 0) live.splice(index, 1)
        }
      }
    },
    cancel() {
      for (const osc of live) {
        try {
          osc.stop()
        } catch {
          // already ended
        }
      }
      live.length = 0
    },
  }
}

function audioContextCtor(): (typeof AudioContext) | undefined {
  if (typeof window === 'undefined') return undefined
  if (typeof window.AudioContext !== 'undefined') return window.AudioContext
  const legacy = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return legacy
}
