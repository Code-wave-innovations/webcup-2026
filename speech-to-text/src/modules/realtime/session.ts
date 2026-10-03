import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "../../config.js";
import { logMetric } from "../../lib/metrics.js";
import {
  analyzeSpeechEnergy,
  decodeToPcm,
} from "../audio/preprocess.js";
import {
  sanitizeProviderError,
} from "../pipeline/run-transcription.js";
import {
  createClaudeRefiner,
  type RefineInput,
  type RefineResult,
} from "../refiner/claude-refiner.js";
import { shouldRefine } from "../refiner/should-refine.js";
import {
  dictionaryTermsForHints,
  mergePromptContext,
} from "../stt/terra-nova-glossary.js";
import { createOpenRouterSttProvider } from "../stt/providers/openrouter-stt.js";
import type { SttProvider, SttResult, TranscriptSegment } from "../stt/types.js";

export type RealtimeMode = "FAST" | "BALANCED" | "ACCURATE";

export interface RealtimeSessionOptions {
  mode: RealtimeMode;
  languageHints?: string[];
  context?: { domain?: string; keywords?: string[] };
}

export interface PartialEvent {
  type: "transcript.partial";
  text: string;
  utteranceId?: number;
}

export interface FinalEvent {
  type: "transcript.final";
  text: string;
  confidence?: number;
  segments: TranscriptSegment[];
  utteranceId?: number;
}

/** Replaces a prior `transcript.final` for the same utterance after Claude refine. */
export interface RefinedEvent {
  type: "transcript.refined";
  text: string;
  utteranceId: number;
  confidence?: number;
  segments: TranscriptSegment[];
}

export interface ErrorEvent {
  type: "error";
  code: string;
  message: string;
}

export type RealtimeEvent = PartialEvent | FinalEvent | RefinedEvent | ErrorEvent;

export interface RealtimeSessionDeps {
  config?: Pick<
    Config,
    | "OPENROUTER_API_KEY"
    | "OPENROUTER_STT_MODEL"
    | "OPENROUTER_REALTIME_STT_MODEL"
    | "OPENROUTER_BASE_URL"
    | "ANTHROPIC_API_KEY"
    | "CLAUDE_REFINER_MODEL"
    | "CONFIDENCE_FALLBACK_THRESHOLD"
    | "REALTIME_SKIP_SPEECH_GATE"
  >;
  sttProvider?: SttProvider;
  refine?: (input: RefineInput) => Promise<RefineResult>;
  writeFile?: typeof fs.writeFile;
  removeFile?: (filePath: string) => Promise<void>;
  makeWorkDir?: () => Promise<string>;
}

function buildPromptContext(context: RealtimeSessionOptions["context"]): string | undefined {
  const parts: string[] = [];
  if (context?.domain) parts.push(context.domain);
  if (context?.keywords?.length) parts.push(context.keywords.join(", "));
  return parts.length ? parts.join(". ") : undefined;
}

function buildRealtimePromptContext(
  options: RealtimeSessionOptions,
): string | undefined {
  return mergePromptContext(options.languageHints, buildPromptContext(options.context));
}

function errorEvent(err: unknown): ErrorEvent {
  if (
    err instanceof Error &&
    (err.name === "GptTranscribeError" || err.name === "OpenRouterSttError")
  ) {
    return { type: "error", code: "STT_FAILED", message: sanitizeProviderError(err, "stt") };
  }
  return { type: "error", code: "REALTIME_ERROR", message: "Realtime transcription failed" };
}

/**
 * Server-side speech gate: decodes the chunk (denoised) and rejects it when it
 * contains no speech at all. Prevents the STT provider from hallucinating text
 * (e.g. "Comment ça va") on silence/background noise chunks.
 */
async function chunkHasSpeech(
  chunkPath: string,
  workDir: string,
  writeFile: typeof fs.writeFile,
): Promise<boolean> {
  const pcmPath = path.join(workDir, "chunk-check.pcm");
  try {
    await decodeToPcm(chunkPath, pcmPath);
    const pcm = await fs.readFile(pcmPath);
    const { speechRatio, longestSpeechMs } = analyzeSpeechEnergy(pcm);
    // Needs some sustained speech, not just a click or breath: ≥10% of frames
    // voiced and at least one 120 ms continuous speech run.
    return speechRatio >= 0.1 && longestSpeechMs >= 120;
  } catch {
    // If the decode/analysis fails, do not drop the chunk: let the STT decide.
    return true;
  }
}

/**
 * One realtime session: accepts binary audio chunks (webm/opus from MediaRecorder),
 * transcribes with OpenRouter Whisper (turbo by default), emits text ASAP, then
 * optionally Claude-refines in the background (`transcript.refined`).
 */
export class RealtimeSession {
  readonly id = crypto.randomUUID();
  private options: RealtimeSessionOptions | null = null;
  private workDir: string | null = null;
  private chunkIndex = 0;
  private closed = false;
  private consecutiveRefineFailures = 0;
  private refineCircuitOpen = false;

  constructor(
    private readonly deps: RealtimeSessionDeps = {},
  ) {}

  async start(options: RealtimeSessionOptions): Promise<void> {
    this.options = options;
    const makeWorkDir = this.deps.makeWorkDir ?? (() => fs.mkdtemp(path.join(os.tmpdir(), "stt-rt-")));
    this.workDir = await makeWorkDir();
    logMetric("realtime.session_started", {
      sessionId: this.id,
      mode: options.mode,
      languageHints: options.languageHints,
    });
  }

  /**
   * @param emit - optional live sink so the WS can push STT text before Claude finishes
   */
  async handleChunk(
    data: Buffer,
    emit?: (event: RealtimeEvent) => void,
  ): Promise<RealtimeEvent[]> {
    const out: RealtimeEvent[] = [];
    const push = (event: RealtimeEvent) => {
      out.push(event);
      emit?.(event);
    };

    if (this.closed || !this.options || !this.workDir) {
      push({ type: "error", code: "SESSION_NOT_STARTED", message: "Send session.start first" });
      return out;
    }
    if (data.length === 0) {
      push({ type: "error", code: "INVALID_CHUNK", message: "Empty audio chunk" });
      return out;
    }

    const utteranceId = ++this.chunkIndex;
    const chunkPath = path.join(this.workDir, `chunk-${utteranceId}.webm`);
    const writeFile = this.deps.writeFile ?? fs.writeFile;
    await writeFile(chunkPath, data);

    const skipGate = this.deps.config?.REALTIME_SKIP_SPEECH_GATE !== false;
    if (!skipGate && !(await chunkHasSpeech(chunkPath, this.workDir, writeFile))) {
      logMetric("realtime.chunk_no_speech", { sessionId: this.id, chunkIndex: utteranceId });
      await this.deleteChunk(chunkPath);
      return out;
    }

    const realtimeModel =
      this.deps.config?.OPENROUTER_REALTIME_STT_MODEL ??
      this.deps.config?.OPENROUTER_STT_MODEL;
    const stt =
      this.deps.sttProvider ??
      createOpenRouterSttProvider(this.deps.config?.OPENROUTER_API_KEY ?? "", {
        model: realtimeModel,
        baseUrl: this.deps.config?.OPENROUTER_BASE_URL,
      });
    let sttResult: SttResult;
    try {
      sttResult = await stt.transcribe({
        audioPath: chunkPath,
        languageHints: this.options.languageHints,
        promptContext: buildRealtimePromptContext(this.options),
        timestamps: false,
      });
    } catch (err) {
      logMetric("realtime.stt_failed", {
        sessionId: this.id,
        provider: stt.name,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.deleteChunk(chunkPath);
      push(errorEvent(err));
      return out;
    }

    logMetric("realtime.stt_completed", {
      sessionId: this.id,
      provider: stt.name,
      latencyMs: sttResult.latencyMs,
    });
    await this.deleteChunk(chunkPath);

    const text = sttResult.text.trim();
    if (!text) {
      return out;
    }

    // Push STT immediately — do not wait for Claude.
    push({ type: "transcript.partial", text, utteranceId });
    push({
      type: "transcript.final",
      text,
      utteranceId,
      ...(sttResult.confidence != null ? { confidence: sttResult.confidence } : {}),
      segments: sttResult.segments,
    });

    if (this.options.mode === "FAST") {
      return out;
    }

    const threshold = this.deps.config?.CONFIDENCE_FALLBACK_THRESHOLD ?? 0.55;
    const decision = shouldRefine({
      text,
      confidence: sttResult.confidence,
      languageHints: this.options.languageHints,
      threshold,
    });

    if (!decision.refine || this.refineCircuitOpen) {
      logMetric("realtime.refine_skipped", {
        sessionId: this.id,
        reason: this.refineCircuitOpen ? "circuit_open" : decision.reason,
      });
      return out;
    }

    const refine =
      this.deps.refine ??
      createClaudeRefiner(this.deps.config?.ANTHROPIC_API_KEY ?? "", {
        model: this.deps.config?.CLAUDE_REFINER_MODEL,
      }).refineTranscript;
    try {
      const dictionaryTerms = dictionaryTermsForHints(this.options.languageHints);
      const refined = await refine({
        text,
        segments: sttResult.segments,
        languageHints: this.options.languageHints,
        context: this.options.context,
        ...(dictionaryTerms ? { dictionaryTerms } : {}),
      });
      this.consecutiveRefineFailures = 0;
      logMetric("realtime.refine_completed", {
        sessionId: this.id,
        languageHints: this.options.languageHints,
      });
      const refinedText = refined.text.trim();
      if (refinedText && refinedText !== text) {
        push({
          type: "transcript.refined",
          text: refinedText,
          utteranceId,
          ...(sttResult.confidence != null ? { confidence: sttResult.confidence } : {}),
          segments: refined.segments,
        });
      }
    } catch (err) {
      this.consecutiveRefineFailures += 1;
      if (this.consecutiveRefineFailures >= 3) {
        this.refineCircuitOpen = true;
        logMetric("realtime.refine_circuit_open", {
          sessionId: this.id,
          failures: this.consecutiveRefineFailures,
        });
      }
      logMetric("realtime.refine_failed", {
        sessionId: this.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return out;
  }

  async end(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.workDir) {
      await fs.rm(this.workDir, { recursive: true, force: true }).catch(() => undefined);
      this.workDir = null;
    }
    logMetric("realtime.session_ended", { sessionId: this.id });
  }

  private async deleteChunk(chunkPath: string): Promise<void> {
    const removeFile = this.deps.removeFile ?? ((p: string) => fs.rm(p, { force: true }));
    await removeFile(chunkPath).catch(() => undefined);
  }
}
