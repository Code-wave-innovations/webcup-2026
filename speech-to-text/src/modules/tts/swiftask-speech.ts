export const DEFAULT_SWIFTASK_API_URL = "https://graphql.swiftask.ai";
/** Swiftask's ElevenLabs bot (`POST /api/ai/:slug`) */
export const DEFAULT_SWIFTASK_TTS_BOT = "elevenlabs";
/**
 * A male voice of the ElevenLabs account behind Swiftask, by name: the bot rejects ids and unknown names
 * (and then falls back to "Alice", a female voice).
 */
export const DEFAULT_SWIFTASK_TTS_VOICE = "George";
export const DEFAULT_SWIFTASK_TTS_MODEL = "eleven_multilingual_v2";
const TIMEOUT_MS = 30_000;

/**
 * Nova's delivery: some variation (a lower stability sounds less read), close to the voice's timbre,
 * a touch of style for the guide's enthusiasm.
 */
const VOICE_SETTINGS = { stability: 0.42, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };

export class SpeechProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SpeechProviderError";
    this.status = status;
  }
}

export interface SpeechProvider {
  /** Identifies the voice in cache keys: a new voice or model never serves an old recording. */
  readonly id: string;
  /** Resolves once the recording is ready; its mp3 bytes then stream in. */
  stream(text: string): Promise<AsyncIterable<Uint8Array>>;
}

export interface SwiftaskSpeechOptions {
  apiKey: string;
  apiUrl?: string;
  bot?: string;
  voice?: string;
  model?: string;
  fetch?: typeof fetch;
}

interface SwiftaskBotResponse {
  text?: string;
  isBotError?: boolean;
  sessionId?: number;
  files?: Array<{ url?: string }>;
  error?: unknown;
}

/**
 * Nova's voice through Swiftask's public API: the bot generates the mp3 with ElevenLabs and returns its
 * url, which is downloaded here (the browser never sees the key nor the storage url).
 */
export function createSwiftaskSpeech(options: SwiftaskSpeechOptions): SpeechProvider {
  const apiUrl = (options.apiUrl ?? DEFAULT_SWIFTASK_API_URL).replace(/\/+$/, "");
  const bot = options.bot ?? DEFAULT_SWIFTASK_TTS_BOT;
  const voice = options.voice ?? DEFAULT_SWIFTASK_TTS_VOICE;
  const model = options.model ?? DEFAULT_SWIFTASK_TTS_MODEL;
  const doFetch = options.fetch ?? fetch;
  // Swiftask creates a conversation for a request without a session: every line goes to the first one
  let sessionId: number | undefined;

  return {
    id: `swiftask:${bot}:${voice}:${model}`,
    async stream(text) {
      const res = await doFetch(`${apiUrl}/api/ai/${encodeURIComponent(bot)}`, {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ input: text, sessionId, extraConfig: { voice, model_id: model, ...VOICE_SETTINGS } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => ({}))) as SwiftaskBotResponse;
      const url = body.files?.[0]?.url;
      if (!res.ok || body.isBotError || !url) {
        const detail = JSON.stringify(body.error ?? body.text ?? body).slice(0, 300);
        throw new SpeechProviderError(`Swiftask ${res.status}: ${detail}`, res.ok ? 502 : res.status);
      }
      if (typeof body.sessionId === "number") sessionId = body.sessionId;

      const audio = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!audio.ok || !audio.body) throw new SpeechProviderError(`Swiftask audio ${audio.status}`, 502);
      return audio.body as unknown as AsyncIterable<Uint8Array>;
    },
  };
}
