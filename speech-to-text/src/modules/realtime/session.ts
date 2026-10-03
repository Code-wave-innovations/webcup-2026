import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "../../config.js";
import { logMetric } from "../../lib/metrics.js";
import {
  sanitizeProviderError,
} from "../pipeline/run-transcription.js";
import {
  createClaudeRefiner,
  type RefineInput,
  type RefineResult,
} from "../refiner/claude-refiner.js";
import { createGptTranscribeProvider } from "../stt/providers/gpt-transcribe.js";
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
}

export interface FinalEvent {
  type: "transcript.final";
  text: string;
  confidence?: number;
  segments: TranscriptSegment[];
}

export interface ErrorEvent {
  type: "error";
  code: string;
  message: string;
}

export type RealtimeEvent = PartialEvent | FinalEvent | ErrorEvent;

export interface RealtimeSessionDeps {
  config?: Pick<Config, "OPENAI_API_KEY" | "ANTHROPIC_API_KEY">;
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

function errorEvent(err: unknown): ErrorEvent {
  if (err instanceof Error && err.name === "GptTranscribeError") {
    return { type: "error", code: "STT_FAILED", message: sanitizeProviderError(err, "stt") };
  }
  return { type: "error", code: "REALTIME_ERROR", message: "Realtime transcription failed" };
}

/**
 * One realtime session: accepts binary audio chunks (webm/opus from MediaRecorder,
 * ~5 s each), transcribes each chunk with the gpt-transcribe provider, refines the
 * text for non-FAST modes, and emits transcript events. Chunks are written to a
 * per-session tmpdir (never the uploads dir) and deleted after transcription.
 */
export class RealtimeSession {
  readonly id = crypto.randomUUID();
  private options: RealtimeSessionOptions | null = null;
  private workDir: string | null = null;
  private chunkIndex = 0;
  private closed = false;

  constructor(
    private readonly deps: RealtimeSessionDeps = {},
  ) {}

  async start(options: RealtimeSessionOptions): Promise<void> {
    this.options = options;
    const makeWorkDir = this.deps.makeWorkDir ?? (() => fs.mkdtemp(path.join(os.tmpdir(), "stt-rt-")));
    this.workDir = await makeWorkDir();
    logMetric("realtime.session_started", { sessionId: this.id, mode: options.mode });
  }

  async handleChunk(data: Buffer): Promise<RealtimeEvent[]> {
    if (this.closed || !this.options || !this.workDir) {
      return [{ type: "error", code: "SESSION_NOT_STARTED", message: "Send session.start first" }];
    }
    if (data.length === 0) {
      return [{ type: "error", code: "INVALID_CHUNK", message: "Empty audio chunk" }];
    }

    const chunkPath = path.join(this.workDir, `chunk-${++this.chunkIndex}.webm`);
    const writeFile = this.deps.writeFile ?? fs.writeFile;
    await writeFile(chunkPath, data);

    const stt = this.deps.sttProvider ?? createGptTranscribeProvider(this.deps.config?.OPENAI_API_KEY ?? "");
    let sttResult: SttResult;
    try {
      sttResult = await stt.transcribe({
        audioPath: chunkPath,
        languageHints: this.options.languageHints,
        promptContext: buildPromptContext(this.options.context),
        timestamps: false,
      });
    } catch (err) {
      logMetric("realtime.stt_failed", {
        sessionId: this.id,
        provider: stt.name,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.deleteChunk(chunkPath);
      return [errorEvent(err)];
    }

    logMetric("realtime.stt_completed", {
      sessionId: this.id,
      provider: stt.name,
      latencyMs: sttResult.latencyMs,
    });
    await this.deleteChunk(chunkPath);

    const partial: PartialEvent = { type: "transcript.partial", text: sttResult.text };

    if (this.options.mode === "FAST") {
      const final: FinalEvent = {
        type: "transcript.final",
        text: sttResult.text,
        ...(sttResult.confidence != null ? { confidence: sttResult.confidence } : {}),
        segments: sttResult.segments,
      };
      return [partial, final];
    }

    const refine =
      this.deps.refine ??
      createClaudeRefiner(this.deps.config?.ANTHROPIC_API_KEY ?? "").refineTranscript;
    try {
      const refined = await refine({
        text: sttResult.text,
        segments: sttResult.segments,
        languageHints: this.options.languageHints,
        context: this.options.context,
      });
      const final: FinalEvent = {
        type: "transcript.final",
        text: refined.text,
        ...(sttResult.confidence != null ? { confidence: sttResult.confidence } : {}),
        segments: refined.segments,
      };
      return [partial, final];
    } catch (err) {
      // Graceful degradation: emit raw STT text as final (same as pipeline behavior).
      logMetric("realtime.refine_failed", {
        sessionId: this.id,
        error: err instanceof Error ? err.message : String(err),
      });
      const final: FinalEvent = {
        type: "transcript.final",
        text: sttResult.text,
        ...(sttResult.confidence != null ? { confidence: sttResult.confidence } : {}),
        segments: sttResult.segments,
      };
      return [partial, final];
    }
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
