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

/** Prefer a voice whose `lang` starts with the locale prefix (`fr`, `en`). */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], locale: SpeakLocale): SpeechSynthesisVoice | null {
  const prefix = locale === 'mg' ? 'mg' : locale
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  return match ?? null
}

function hasSpeechSynthesis(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
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

  const utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.lang = localeToBcp47(locale)
  utterance.rate = 0.95
  const voice = pickVoice(globalThis.speechSynthesis.getVoices(), locale)
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
