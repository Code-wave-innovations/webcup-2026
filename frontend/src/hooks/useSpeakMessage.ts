import { useEffect, useState, useSyncExternalStore } from 'react'

export type SpeakLocale = 'fr' | 'en' | 'mg'

export type SpeakOptions = {
  /** Required for `mg`: public path to a pre-generated wav/mp3 */
  audioUrl?: string
  /** Default true: ignore speak while muted */
  respectMute?: boolean
}

type SpeakSnapshot = {
  speaking: boolean
  muted: boolean
}

const BCP47: Record<SpeakLocale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  mg: 'mg-MG',
}

export function localeToBcp47(locale: SpeakLocale): string {
  return BCP47[locale]
}

/**
 * macOS novelty / effect voices (mechanical, not natural people).
 * Prefer these even when speaking FR/EN — locale human voices like Thomas/Samantha are last resort.
 */
const ROBOT_VOICE_PRIORITY = [
  'trinoids', // a bit clearer than Zarvox, still mechanical
  'zarvox',
  'fred',
  'bad news',
  'organ',
  'cellos',
  'bahh',
  'boing',
  'wobble',
  'jester',
  'superstar',
  'bells',
  'bubbles',
  'good news',
  'whisper',
] as const

function robotRank(name: string): number {
  const lower = name.toLowerCase()
  const idx = ROBOT_VOICE_PRIORITY.findIndex((key) => lower.includes(key))
  return idx === -1 ? Number.POSITIVE_INFINITY : idx
}

/** Prefer a novelty/robot voice; fall back to a matching locale human voice. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], locale: SpeakLocale): SpeechSynthesisVoice | null {
  const robots = voices
    .filter((v) => robotRank(v.name) !== Number.POSITIVE_INFINITY)
    .sort((a, b) => robotRank(a.name) - robotRank(b.name))
  if (robots[0]) return robots[0]

  const prefix = locale === 'mg' ? 'mg' : locale
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null
}

/** Slower + lower pitch ≈ more “robot / radio” over Web Speech. */
const ROBOT_RATE = 0.72
const ROBOT_PITCH = 0.68

function hasSpeechSynthesis(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** Chrome/Safari often return [] until `voiceschanged` fires. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = globalThis.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', done)
    // Fallback if the event never fires
    globalThis.setTimeout(done, 300)
  })
}

let muted = false
let speaking = false
let currentAudio: HTMLAudioElement | null = null
let unlocked = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function getSnapshot(): SpeakSnapshot {
  return { speaking, muted }
}

let cachedSnapshot: SpeakSnapshot = getSnapshot()

function updateSnapshot(patch: Partial<SpeakSnapshot>): void {
  if (patch.speaking !== undefined) speaking = patch.speaking
  if (patch.muted !== undefined) muted = patch.muted
  cachedSnapshot = getSnapshot()
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getServerSnapshot(): SpeakSnapshot {
  return { speaking: false, muted: false }
}

/** Test-only: clear singleton playback state between cases. */
export function resetSpeakMessageForTests(): void {
  stopSpeaking()
  muted = false
  speaking = false
  unlocked = false
  currentAudio = null
  cachedSnapshot = getSnapshot()
}

export function setSpeakMuted(next: boolean): void {
  if (muted === next) return
  updateSnapshot({ muted: next })
  if (next) stopSpeaking()
}

export function stopSpeaking(): void {
  if (hasSpeechSynthesis()) {
    globalThis.speechSynthesis.cancel()
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (speaking) updateSnapshot({ speaking: false })
}

/**
 * Unlock HTMLAudio playback after a user gesture (autoplay policy).
 * Safe to call multiple times.
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return
  const audio = new Audio()
  audio.src =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
  try {
    await audio.play()
    audio.pause()
    unlocked = true
  } catch {
    // Still blocked; caller can retry after another gesture.
  }
}

export async function speakMessage(
  text: string,
  locale: SpeakLocale,
  options: SpeakOptions = {},
): Promise<void> {
  const respectMute = options.respectMute !== false
  if (respectMute && muted) return

  const trimmed = text.trim()
  if (!trimmed && locale !== 'mg') return

  stopSpeaking()

  if (locale === 'mg') {
    const url = options.audioUrl?.trim()
    if (!url) {
      if (import.meta.env.DEV) {
        console.warn('[useSpeakMessage] locale "mg" requires options.audioUrl (pre-generated MMS audio)')
      }
      return
    }
    const audio = new Audio(url)
    currentAudio = audio
    updateSnapshot({ speaking: true })

    await new Promise<void>((resolve, reject) => {
      const clear = () => {
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError)
      }
      const onEnded = () => {
        clear()
        if (currentAudio === audio) currentAudio = null
        updateSnapshot({ speaking: false })
        resolve()
      }
      const onError = () => {
        clear()
        if (currentAudio === audio) currentAudio = null
        updateSnapshot({ speaking: false })
        reject(new Error(`Failed to play TTS audio: ${url}`))
      }
      audio.addEventListener('ended', onEnded)
      audio.addEventListener('error', onError)
      void audio.play().catch((err: unknown) => {
        clear()
        if (currentAudio === audio) currentAudio = null
        updateSnapshot({ speaking: false })
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })
    return
  }

  if (!hasSpeechSynthesis()) {
    if (import.meta.env.DEV) {
      console.warn('[useSpeakMessage] speechSynthesis is not available in this environment')
    }
    return
  }

  const voices = await loadVoices()
  const utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.lang = localeToBcp47(locale)
  utterance.rate = ROBOT_RATE
  utterance.pitch = ROBOT_PITCH
  const voice = pickVoice(voices, locale)
  if (voice) utterance.voice = voice

  updateSnapshot({ speaking: true })

  await new Promise<void>((resolve) => {
    utterance.onend = () => {
      updateSnapshot({ speaking: false })
      resolve()
    }
    utterance.onerror = () => {
      updateSnapshot({ speaking: false })
      resolve()
    }
    globalThis.speechSynthesis.speak(utterance)
  })
}

export function useSpeakMessage(): {
  speak: (text: string, locale: SpeakLocale, options?: SpeakOptions) => Promise<void>
  stop: () => void
  speaking: boolean
  muted: boolean
  setMuted: (muted: boolean) => void
  unlock: () => Promise<void>
  supported: { speechSynthesis: boolean }
} {
  const snapshot = useSyncExternalStore(subscribe, () => cachedSnapshot, getServerSnapshot)
  const [supported] = useState(() => ({ speechSynthesis: hasSpeechSynthesis() }))

  useEffect(() => () => stopSpeaking(), [])

  return {
    speak: speakMessage,
    stop: stopSpeaking,
    speaking: snapshot.speaking,
    muted: snapshot.muted,
    setMuted: setSpeakMuted,
    unlock: unlockAudio,
    supported,
  }
}
