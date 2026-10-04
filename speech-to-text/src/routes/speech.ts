import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import { createRealtimeTokenIssuer } from "../modules/realtime/tokens.js";
import { createSwiftaskSpeech, SpeechProviderError, type SpeechProvider } from "../modules/tts/swiftask-speech.js";
import { createCharBudget, createDiskSpeechCache, speechCacheKey, type SpeechCache } from "../modules/tts/speech-cache.js";

export interface SpeechRouteDeps {
  speechProvider?: SpeechProvider | null;
  speechCache?: SpeechCache;
}

/** Recordings never change for a given voice and text. */
const CACHE_CONTROL = "private, max-age=86400";

/**
 * `GET /v1/speech?text=…&token=…`: Nova's voice (Swiftask text-to-speech) as an mp3 the browser plays straight from an `<audio>`
 * src while it streams in. Auth is the short-lived realtime token (an audio element cannot send headers).
 * Cached recordings are served from disk; new ones count against a per-minute character budget.
 */
export const speechRoutes =
  (config: Config, deps: SpeechRouteDeps = {}): FastifyPluginAsync =>
  async (app) => {
    const issuer = createRealtimeTokenIssuer(config.STT_API_KEY, config.REALTIME_TOKEN_TTL_SEC);
    const provider =
      deps.speechProvider !== undefined
        ? deps.speechProvider
        : config.SWIFTASK_API_KEY
          ? createSwiftaskSpeech({
              apiKey: config.SWIFTASK_API_KEY,
              apiUrl: config.SWIFTASK_API_URL,
              bot: config.SWIFTASK_TTS_BOT,
              voice: config.SWIFTASK_TTS_VOICE,
              model: config.SWIFTASK_TTS_MODEL,
            })
          : null;
    const cache = deps.speechCache ?? createDiskSpeechCache(config.TTS_CACHE_DIR);
    const budget = createCharBudget(config.TTS_CHARS_PER_MINUTE);
    const query = z.object({
      token: z.string().min(1),
      text: z.string().trim().min(1).max(config.TTS_MAX_CHARS),
    });

    app.get("/v1/speech", async (req, reply) => {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "INVALID_TEXT", message: `text: 1 to ${config.TTS_MAX_CHARS} characters` } });
      }
      if (!issuer.verify(parsed.data.token)) {
        return reply.code(401).send({ error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } });
      }
      if (!provider) {
        return reply.code(503).send({ error: { code: "TTS_NOT_CONFIGURED", message: "SWIFTASK_API_KEY is not set" } });
      }

      const { text } = parsed.data;
      const key = speechCacheKey(provider.id, text);
      const cached = await cache.get(key);
      if (cached) return reply.type("audio/mpeg").header("cache-control", CACHE_CONTROL).send(cached);

      if (!budget.take(text.length)) {
        return reply.code(429).send({ error: { code: "TTS_BUDGET", message: "Too many characters this minute" } });
      }
      let audio: AsyncIterable<Uint8Array>;
      try {
        audio = await provider.stream(text);
      } catch (err) {
        req.log.error({ err }, "speech provider failed");
        const status = err instanceof SpeechProviderError && err.status === 429 ? 429 : 502;
        return reply.code(status).send({ error: { code: "TTS_PROVIDER", message: "The voice provider failed" } });
      }

      // streamed to the browser as it arrives, and kept once complete (an aborted download is not cached)
      async function* tee() {
        const parts: Buffer[] = [];
        for await (const chunk of audio) {
          const part = Buffer.from(chunk);
          parts.push(part);
          yield part;
        }
        await cache.set(key, Buffer.concat(parts)).catch((err: unknown) => req.log.warn({ err }, "speech cache write failed"));
      }
      return reply.type("audio/mpeg").header("cache-control", CACHE_CONTROL).send(Readable.from(tee()));
    });
  };
