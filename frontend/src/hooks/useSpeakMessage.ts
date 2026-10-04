import { useSyncExternalStore } from 'react'

export interface SpeakOptions {
  /** a pre-generated recording to play instead of Nova's voice (Malagasy: `public/tts/`) */
  audioUrl?: string
}

/**
 * Nova's voice is a male neural voice from Swiftask's text-to-speech (its ElevenLabs bot, `POST /api/ai/elevenlabs`),
 * called straight from the browser with `SWIFTASK_API_KEY`. There is no other voice: a line that cannot be
 * had stays silent. Each sentence is a separate recording; their urls are permanent, so they are remembered in
 * this browser and a fixed sentence is generated once.
 */
const SWIFTASK_API_URL = 'https://graphql.swiftask.ai'
/** Swiftask API key: Vite only exposes `VITE_*` variables to the browser, and the value ends up in the public bundle */
const swiftaskApiKey = (): string => import.meta.env.SWIFTASK_API_KEY ?? ''
const SWIFTASK_TTS_BOT = 'elevenlabs'
/** a male voice of Swiftask's ElevenLabs account, by name (the bot rejects ids and falls back to a female voice) */
const VOICE = 'George'
const MODEL = 'eleven_multilingual_v2'
/** Nova's delivery: some variation (sounds less read), close to the voice's timbre, a touch of enthusiasm */
const VOICE_SETTINGS = { stability: 0.42, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
const MAX_SENTENCE = 300
/** Swiftask takes 5 to 10 s to generate a new sentence */
const FETCH_TIMEOUT_MS = 30_000
/** sentence → url of its recording, kept in this browser (per voice: a new voice never plays an old recording) */
const STORAGE_KEY = `nova:voix:${VOICE}:${MODEL}`
/** the Swiftask conversation the lines go to (without one, Swiftask creates a new one per request) */
const SESSION_KEY = 'nova:voix:session'
const MAX_REMEMBERED = 400
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
/** sentence → url of its recording (a promise while Swiftask generates it) */
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

/**
 * Nova's robot timbre, added in the browser to Swiftask's voice (the recordings stay untouched):
 * a ring modulator for the metallic buzz, a short comb echo for the hollow "inside a helmet" sound,
 * a high-pass that thins the voice. `null` plays the voice as recorded.
 */
const ROBOT: { ringHz: number; ringMix: number; combMs: number; combFeedback: number; highpassHz: number } | null = {
  ringHz: 55,
  ringMix: 0.45,
  combMs: 8,
  combFeedback: 0.4,
  highpassHz: 160,
}
let robotContext: AudioContext | null = null

/** Routes the player through the robot effect (WebAudio); without WebAudio, the voice plays as recorded. */
function robotize(audio: HTMLAudioElement): void {
  if (!ROBOT || typeof AudioContext === 'undefined') return
  const context = new AudioContext()
  const source = context.createMediaElementSource(audio)
  const bus = context.createGain()

  // dry voice plus the voice multiplied by a low sine (ring modulation)
  const dry = context.createGain()
  dry.gain.value = 1 - ROBOT.ringMix
  const ring = context.createGain()
  ring.gain.value = 0
  const carrier = context.createOscillator()
  carrier.frequency.value = ROBOT.ringHz
  const depth = context.createGain()
  depth.gain.value = ROBOT.ringMix
  carrier.connect(depth).connect(ring.gain)
  carrier.start()
  source.connect(dry).connect(bus)
  source.connect(ring).connect(bus)

  // comb echo: a few milliseconds fed back into itself
  const comb = context.createDelay(0.05)
  comb.delayTime.value = ROBOT.combMs / 1000
  const feedback = context.createGain()
  feedback.gain.value = ROBOT.combFeedback
  bus.connect(comb).connect(feedback).connect(comb)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = ROBOT.highpassHz
  const compressor = context.createDynamicsCompressor()
  bus.connect(highpass)
  comb.connect(highpass)
  highpass.connect(compressor).connect(context.destination)
  robotContext = context
}

function audioPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio()
    // the recordings come from Swiftask's file server: WebAudio may only process them with CORS
    player.crossOrigin = 'anonymous'
    robotize(player)
  }
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
  void robotContext?.resume()
  void audio.play().catch(() => undefined)
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private window or full storage: remembered for this visit only
  }
}

/** Keeps a generated recording's url for the next visits (the oldest are forgotten first). */
function remember(sentence: string, url: string): void {
  const urls = readStorage<Record<string, string>>(STORAGE_KEY, {})
  delete urls[sentence]
  urls[sentence] = url
  const kept = Object.entries(urls).slice(-MAX_REMEMBERED)
  writeStorage(STORAGE_KEY, Object.fromEntries(kept))
}

/** Asks Swiftask to record one sentence with Nova's voice; resolves to the url of the mp3. */
async function generate(sentence: string): Promise<string> {
  const apiKey = swiftaskApiKey()
  if (!apiKey) throw new Error('SWIFTASK_API_KEY is not set')
  const sessionId = readStorage<number | null>(SESSION_KEY, null) ?? undefined
  const res = await fetch(`${SWIFTASK_API_URL}/api/ai/${SWIFTASK_TTS_BOT}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ input: sentence, sessionId, extraConfig: { voice: VOICE, model_id: MODEL, ...VOICE_SETTINGS } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const body = (await res.json().catch(() => ({}))) as { isBotError?: boolean; sessionId?: number; files?: Array<{ url?: string }>; text?: string }
  const url = body.files?.[0]?.url
  if (!res.ok || body.isBotError || !url) throw new Error(`Swiftask ${res.status}: ${body.text ?? 'no audio'}`)
  if (typeof body.sessionId === 'number') writeStorage(SESSION_KEY, body.sessionId)
  return url
}

/** The url of one sentence's recording (null when it could not be had): remembered, else generated once. */
function recording(sentence: string): Promise<string | null> {
  const known = recordings.get(sentence)
  if (known) return known
  const stored = readStorage<Record<string, string>>(STORAGE_KEY, {})[sentence]
  const loading = stored
    ? Promise.resolve(stored)
    : generate(sentence)
        .then((url) => {
          remember(sentence, url)
          return url
        })
        .catch((error: unknown) => {
          // not kept: the next time it is asked for, it is tried again
          recordings.delete(sentence)
          if (import.meta.env.DEV) console.warn('[voix de Nova] Swiftask text-to-speech failed:', error)
          return null
        })
  recordings.set(sentence, loading)
  return loading
}

/**
 * Plays one source on the shared player; resolves when it ends, fails or is stopped, with `blocked` when
 * the browser refused to play before any click (autoplay rules).
 */
function play(src: string): Promise<'done' | 'blocked'> {
  const audio = audioPlayer()
  return new Promise((resolve) => {
    const finish = (outcome: 'done' | 'blocked' = 'done') => {
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onEnd)
      abortPlayback = null
      setState({ speaking: false })
      resolve(outcome)
    }
    const onEnd = () => finish()
    abortPlayback = finish
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onEnd)
    audio.src = src
    // the robot effect's context starts suspended until the visitor's first click
    void robotContext?.resume()
    audio
      .play()
      .then(() => setState({ speaking: true }))
      .catch((error: unknown) => finish(error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'done'))
  })
}

/** A line refused before the visitor's first click is said at that click (unless another line came since). */
function sayAtFirstGesture(text: string, options: SpeakOptions, run: number): void {
  const events = ['pointerdown', 'keydown'] as const
  const resume = () => {
    for (const event of events) document.removeEventListener(event, resume, true)
    if (run === generation) {
      unlockSpeech()
      void speakMessage(text, options)
    }
  }
  for (const event of events) document.addEventListener(event, resume, { capture: true, once: true })
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
    if (src && (await play(src)) === 'blocked') {
      setState({ busy: false })
      if (run === generation) sayAtFirstGesture(text, options, run)
      return
    }
    if (run !== generation) return
  }
  setState({ busy: false })
}

/**
 * Generates the recordings of lines Nova is about to say (in the background, a few at a time), so that
 * they play at once (and are remembered in this browser).
 */
export async function warmSpeech(texts: readonly string[]): Promise<void> {
  const queue = [...new Set(texts.flatMap(sentencesOf))]
  const worker = async () => {
    for (let sentence = queue.shift(); sentence !== undefined; sentence = queue.shift()) await recording(sentence)
  }
  await Promise.all(Array.from({ length: WARM_CONCURRENCY }, worker))
}

/** Test-only: forget the player and the recordings of this tab. */
export function resetSpeechForTests(): void {
  stopSpeaking()
  player = null
  recordings.clear()
}

/** The app's voice, for components: read a text aloud, stop it, and whether it is speaking. */
export function useSpeakMessage() {
  const active = useSyncExternalStore(subscribeSpeaking, isSpeaking, () => false)
  return { speak: speakMessage, stop: stopSpeaking, speaking: active, supported: canPlayAudio() }
}
