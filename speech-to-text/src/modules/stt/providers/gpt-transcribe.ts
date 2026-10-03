import fs from "node:fs";
import OpenAI from "openai";
import type {
  TranscriptionCreateResponse,
  TranscriptionSegment as OpenAiSegment,
  TranscriptionVerbose,
} from "openai/resources/audio/transcriptions.js";
import type { SttInput, SttProvider, SttResult, TranscriptSegment } from "../types.js";
import { buildLanguagePrompt, resolveApiLanguage } from "../language.js";

export const GPT_TRANSCRIBE_PROVIDER_NAME = "gpt-transcribe";
export const GPT_TRANSCRIBE_MODEL = "gpt-4o-transcribe";

/** whisper-1 + verbose_json is used when segment timestamps are required (gpt transcribe models are json-only). */
export const WHISPER_TIMESTAMP_MODEL = "whisper-1";

export class GptTranscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GptTranscribeError";
  }
}

export type GptTranscribeClient = Pick<OpenAI, "audio">;

export interface GptTranscribeDeps {
  client?: GptTranscribeClient;
  createReadStream?: typeof fs.createReadStream;
}

function logprobToConfidence(avgLogprob: number): number {
  const p = Math.exp(avgLogprob);
  return Math.max(0, Math.min(1, p));
}

function mapOpenAiSegments(segments: OpenAiSegment[]): TranscriptSegment[] {
  return segments.map((seg) => ({
    startMs: Math.round(seg.start * 1000),
    endMs: Math.round(seg.end * 1000),
    text: seg.text.trim(),
    confidence: logprobToConfidence(seg.avg_logprob),
  }));
}

function isTranscriptionVerbose(
  raw: TranscriptionCreateResponse,
): raw is TranscriptionVerbose {
  return typeof raw === "object" && raw !== null && "text" in raw && !Array.isArray(raw);
}

/** Maps OpenAI transcription responses to {@link SttResult}. Exported for unit tests. */
export function mapGptTranscriptionToSttResult(
  raw: TranscriptionCreateResponse,
  latencyMs: number,
): SttResult {
  const text = raw.text.trim();
  let segments: TranscriptSegment[] = [];
  let language: string | undefined;
  let confidence: number | undefined;

  if (isTranscriptionVerbose(raw)) {
    language = raw.language;
    if (raw.segments?.length) {
      segments = mapOpenAiSegments(raw.segments);
      const avgLogprob =
        raw.segments.reduce((sum, seg) => sum + seg.avg_logprob, 0) /
        raw.segments.length;
      confidence = logprobToConfidence(avgLogprob);
    } else if (raw.words?.length) {
      const startMs = Math.round(raw.words[0].start * 1000);
      const endMs = Math.round(raw.words[raw.words.length - 1].end * 1000);
      segments = [
        {
          startMs,
          endMs,
          text: raw.words.map((w) => w.word).join(" ").trim() || text,
        },
      ];
    } else {
      const endMs =
        typeof raw.duration === "number" ? Math.round(raw.duration * 1000) : 0;
      segments = [{ startMs: 0, endMs, text }];
    }
  } else {
    segments = [{ startMs: 0, endMs: 0, text }];
  }

  return {
    text,
    language,
    confidence,
    segments,
    raw,
    latencyMs,
  };
}

export function createGptTranscribeProvider(
  apiKey: string,
  deps: GptTranscribeDeps = {},
): SttProvider {
  const client = deps.client ?? new OpenAI({ apiKey });
  const createReadStream = deps.createReadStream ?? fs.createReadStream;

  return {
    name: GPT_TRANSCRIBE_PROVIDER_NAME,
    async transcribe(input: SttInput): Promise<SttResult> {
      const { audioPath, languageHints, promptContext, timestamps } = input;

      if (audioPath.toLowerCase().endsWith(".pcm")) {
        throw new GptTranscribeError(
          "gpt-transcribe expects a container audio file (wav, mp3, m4a, …); " +
            "pass the original upload path or convert PCM with FFmpeg before calling this provider",
        );
      }

      const wantTimestamps = timestamps !== false;
      const started = Date.now();

      // Force the language only when a single OpenAI-recognized hint is given;
      // unsupported codes (e.g. mg) and multi-hint lists use the prompt instead.
      const language = resolveApiLanguage(languageHints);
      const prompt = buildLanguagePrompt(languageHints, promptContext);

      if (wantTimestamps) {
        const raw = await client.audio.transcriptions.create({
          file: createReadStream(audioPath),
          model: WHISPER_TIMESTAMP_MODEL,
          response_format: "verbose_json",
          timestamp_granularities: ["segment"],
          ...(language ? { language } : {}),
          ...(prompt ? { prompt } : {}),
        });
        return mapGptTranscriptionToSttResult(raw, Date.now() - started);
      }

      const raw = await client.audio.transcriptions.create({
        file: createReadStream(audioPath),
        model: GPT_TRANSCRIBE_MODEL,
        response_format: "json",
        ...(language ? { language } : {}),
        ...(prompt ? { prompt } : {}),
      });
      return mapGptTranscriptionToSttResult(raw, Date.now() - started);
    },
  };
}
