import { useSyncExternalStore } from 'react'
import { sttApiUrl } from './useRealtimeTranscription'

export interface SpeakOptions {
  /** a pre-generated recording to play instead of Nova's voice (Malagasy: `public/tts/`) */
  audioUrl?: string
}

/**
 * Nova's voice is a male neural voice from Swiftask's text-to-speech, served by the STT service
 * (`GET /v1/speech`, cached on its disk). There is no other voice: a line that cannot be fetched stays silent.
 * Each sentence is a separate recording, so the fixed sentences of a line are reused from the cache.
 */
const MAX_SENTENCE = 300
/** Swiftask takes 5 to 7 s to generate a new sentence */
const FETCH_TIMEOUT_MS = 30_000
/** a token is renewed this long before it expires */
const TOKEN_MARGIN_MS = 30_000
/** recordings kept in this tab (object URLs), oldest dropped first */
const MEMORY_CACHE = 120
/** recordings generated at the same time by a warm-up */
const WARM_CONCURRENCY = 2
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

/** What is read aloud: no emoji, markup or links, single spaces. */
export function speechText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[*_`#>~]+/g, '')
    .replace(/\s*[·•|]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits a text into sentences of at most `max` characters (a long sentence is cut at its last space). */
export function splitSentences(text: string, max = MAX_SENTENCE): string[] {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)/g) ?? []
  const chunks: string[] = []
  for (const raw of sentences) {
    let sentence = raw.trim()
    while (sentence.length > max) {
      const cut = sentence.lastIndexOf(' ', max)
      const at = cut > 0 ? cut : max
      chunks.push(sentence.slice(0, at).trim())
      sentence = sentence.slice(at).trim()
    }
    if (sentence) chunks.push(sentence)
  }
  return chunks
}

/** The sentences Nova will say for `text`, as recorded one by one. */
function sentencesOf(text: string): string[] {
  return splitSentences(speechText(text))
}

function canPlayAudio(): boolean {
  return typeof Audio !== 'undefined'
}

// one voice for the whole app: a new line interrupts the previous one
/** a recording is playing (Nova's mouth moves) */
let speaking = false
/** a line was asked for and is not finished: loading or playing */
let busy = false
/** bumped by every speak/stop: an interrupted line stops where it is */
let generation = 0
/** a single audio element, unlocked once by a gesture (iOS refuses to start new ones without it) */
let player: HTMLAudioElement | null = null
/** ends the recording being played (stop) */
let abortPlayback: (() => void) | null = null
let token: { value: string; expiresAt: number } | null = null
/** sentence → object URL of its recording (a promise while it downloads) */
const recordings = new Map<string, Promise<string | null>>()
const listeners = new Set<() => void>()

function setState(next: { speaking?: boolean; busy?: boolean }): void {
  const changed = (next.speaking !== undefined && next.speaking !== speaking) || (next.busy !== undefined && next.busy !== busy)
  speaking = next.speaking ?? speaking
  busy = next.busy ?? busy
  if (changed) for (const listener of listeners) listener()
}

/** Called when the voice starts or stops; returns the unsubscribe. */
export function subscribeSpeaking(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A recording is playing. */
export function isSpeaking(): boolean {
  return speaking
}

/** A line is on its way or playing (the film's murmurs keep quiet meanwhile). */
export function isVoiceBusy(): boolean {
  return busy
}

function audioPlayer(): HTMLAudioElement {
  player ??= new Audio()
  return player
}

/** Silences the voice at once. */
export function stopSpeaking(): void {
  generation++
  abortPlayback?.()
  abortPlayback = null
  player?.pause()
  setState({ speaking: false, busy: false })
}

/**
 * Lets the voice play later without a click (autoplay rules, iOS): call it from a user gesture,
 * such as turning the sound on.
 */
export function unlockSpeech(): void {
  if (!canPlayAudio()) return
  const audio = audioPlayer()
  audio.src = SILENT_WAV
  void audio.play().catch(() => undefined)
}

/** A short-lived token from the STT service (the browser never holds a key), reused until it expires. */
async function speechToken(): Promise<string> {
  if (token && token.expiresAt - TOKEN_MARGIN_MS > Date.now()) return token.value
  const res = await fetch(`${sttApiUrl}/v1/realtime/tokens`, { method: 'POST' })
  if (!res.ok) throw new Error(`speech token ${res.status}`)
  const body = (await res.json()) as { token: string; expiresAt: string }
  token = { value: body.token, expiresAt: Date.parse(body.expiresAt) }
  return token.value
}

/** The recording of one sentence as an object URL (null when it could not be had); downloaded once per tab. */
function recording(sentence: string): Promise<string | null> {
  const known = recordings.get(sentence)
  if (known) {
    // most recently used last
    recordings.delete(sentence)
    recordings.set(sentence, known)
    return known
  }
  const loading = speechToken()
    .then((value) => fetch(`${sttApiUrl}/v1/speech?${new URLSearchParams({ text: sentence, token: value })}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }))
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`speech ${res.status}`))))
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => {
      // not kept: the next time it is asked for, it is tried again
      recordings.delete(sentence)
      return null
    })
  recordings.set(sentence, loading)
  while (recordings.size > MEMORY_CACHE) {
    const [oldest, url] = recordings.entries().next().value!
    recordings.delete(oldest)
    void url.then((u) => u && URL.revokeObjectURL(u))
  }
  return loading
}

/** Plays one source on the shared player; resolves when it ends, fails or is stopped. */
function play(src: string): Promise<void> {
  const audio = audioPlayer()
  return new Promise((resolve) => {
    const finish = () => {
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', finish)
      abortPlayback = null
      setState({ speaking: false })
      resolve()
    }
    abortPlayback = finish
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)
    audio.src = src
    audio
      .play()
      .then(() => setState({ speaking: true }))
      .catch(finish)
  })
}

/**
 * Reads `text` aloud with Nova's voice, interrupting whatever was being said. All its sentences are
 * requested at once and played in order. Resolves when the reading ends or is interrupted; never rejects.
 */
export async function speakMessage(text: string, options: SpeakOptions = {}): Promise<void> {
  stopSpeaking()
  if (!canPlayAudio()) return
  const run = generation
  const sources = options.audioUrl ? [Promise.resolve(options.audioUrl)] : sentencesOf(text).map(recording)
  if (!sources.length) return
  setState({ busy: true })
  for (const source of sources) {
    const src = await source
    if (run !== generation) return
    if (src) await play(src)
    if (run !== generation) return
  }
  setState({ busy: false })
}

/**
 * Generates the recordings of lines Nova is about to say (in the background, a few at a time), so that
 * they play at once: the STT service keeps them on disk for every visitor, this tab in memory.
 */
export async function warmSpeech(texts: readonly string[]): Promise<void> {
  const queue = [...new Set(texts.flatMap(sentencesOf))]
  const worker = async () => {
    for (let sentence = queue.shift(); sentence !== undefined; sentence = queue.shift()) await recording(sentence)
  }
  await Promise.all(Array.from({ length: WARM_CONCURRENCY }, worker))
}

/** Test-only: forget the token, the player and the recordings. */
export function resetSpeechForTests(): void {
  stopSpeaking()
  player = null
  token = null
  recordings.clear()
}

/** The app's voice, for components: read a text aloud, stop it, and whether it is speaking. */
export function useSpeakMessage() {
  const active = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false)
  return { speak: speakMessage, stop: stopSpeaking, speaking: active, supported: canPlayAudio() }
}
