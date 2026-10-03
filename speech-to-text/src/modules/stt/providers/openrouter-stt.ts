import fs from "node:fs/promises";
import type { SttInput, SttProvider, SttResult, TranscriptSegment } from "../types.js";
import {
  audioFormatFromPath,
  buildLanguagePrompt,
  resolveApiLanguage,
} from "../language.js";

export const OPENROUTER_STT_PROVIDER_NAME = "openrouter-stt";
export const DEFAULT_OPENROUTER_STT_MODEL = "openai/whisper-large-v3";
export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterSttError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterSttError";
  }
}

export interface OpenRouterSttDeps {
  fetch?: typeof fetch;
  readFile?: (path: string) => Promise<Buffer>;
  baseUrl?: string;
  model?: string;
}

interface OpenRouterSegment {
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
}

interface OpenRouterTranscriptionResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: OpenRouterSegment[];
  error?: { message?: string };
}

function logprobToConfidence(avgLogprob: number): number {
  const p = Math.exp(avgLogprob);
  return Math.max(0, Math.min(1, p));
}

function mapResponse(
  raw: OpenRouterTranscriptionResponse,
  latencyMs: number,
): SttResult {
  const text = (raw.text ?? "").trim();
  let segments: TranscriptSegment[] = [];
  let confidence: number | undefined;

  if (raw.segments?.length) {
    segments = raw.segments.map((seg) => {
      const out: TranscriptSegment = {
        startMs: Math.round((seg.start ?? 0) * 1000),
        endMs: Math.round((seg.end ?? 0) * 1000),
        text: (seg.text ?? "").trim(),
      };
      if (typeof seg.avg_logprob === "number") {
        out.confidence = logprobToConfidence(seg.avg_logprob);
      }
      return out;
    });
    const withLp = raw.segments.filter((s) => typeof s.avg_logprob === "number");
    if (withLp.length) {
      const avg =
        withLp.reduce((sum, s) => sum + (s.avg_logprob as number), 0) / withLp.length;
      confidence = logprobToConfidence(avg);
    }
  } else {
    const endMs =
      typeof raw.duration === "number" ? Math.round(raw.duration * 1000) : 0;
    segments = [{ startMs: 0, endMs, text }];
  }

  return {
    text,
    ...(raw.language ? { language: raw.language } : {}),
    ...(confidence != null ? { confidence } : {}),
    segments,
    raw,
    latencyMs,
  };
}

export function createOpenRouterSttProvider(
  apiKey: string,
  deps: OpenRouterSttDeps = {},
): SttProvider {
  const doFetch = deps.fetch ?? fetch;
  const readFile = deps.readFile ?? ((p: string) => fs.readFile(p));
  const baseUrl = (deps.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");
  const model = deps.model ?? DEFAULT_OPENROUTER_STT_MODEL;

  return {
    name: OPENROUTER_STT_PROVIDER_NAME,
    async transcribe(input: SttInput): Promise<SttResult> {
      const { audioPath, languageHints, promptContext, timestamps } = input;

      if (audioPath.toLowerCase().endsWith(".pcm")) {
        throw new OpenRouterSttError(
          "openrouter-stt expects a container audio file (wav, mp3, webm, …); " +
            "convert PCM with FFmpeg before calling this provider",
        );
      }

      const started = Date.now();
      const buf = await readFile(audioPath);
      const format = audioFormatFromPath(audioPath);
      const language = resolveApiLanguage(languageHints);
      const prompt = buildLanguagePrompt(languageHints, promptContext);
      const wantTimestamps = timestamps !== false;

      const body: Record<string, unknown> = {
        model,
        input_audio: {
          data: buf.toString("base64"),
          format,
        },
        response_format: wantTimestamps ? "verbose_json" : "json",
        temperature: 0,
      };
      if (wantTimestamps) {
        body.timestamp_granularities = ["segment"];
      }
      if (language) body.language = language;
      if (prompt) body.prompt = prompt;

      const res = await doFetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const raw = (await res.json()) as OpenRouterTranscriptionResponse;
      if (!res.ok) {
        const msg = raw.error?.message ?? `OpenRouter STT HTTP ${res.status}`;
        throw new OpenRouterSttError(msg);
      }

      return mapResponse(raw, Date.now() - started);
    },
  };
}
