import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig, type Config } from "../../config.js";
import { logMetric } from "../../lib/metrics.js";
import { prisma } from "../../lib/prisma.js";
import {
  isAudioPreprocessError,
  pcmToWav,
  preprocessAudio,
} from "../audio/preprocess.js";
import {
  createClaudeRefiner,
  type RefineInput,
  type RefineResult,
} from "../refiner/claude-refiner.js";
import { shouldRefine } from "../refiner/should-refine.js";
import { createOpenRouterSttProvider } from "../stt/providers/openrouter-stt.js";
import {
  dictionaryTermsForHints,
  mergePromptContext,
} from "../stt/terra-nova-glossary.js";
import type { SttProvider, SttResult, TranscriptSegment } from "../stt/types.js";
import { normalizeSegments } from "../timestamps/normalize.js";

/** Minimal DB surface used by the pipeline (satisfied by PrismaClient; fakeable in tests). */
export interface PipelineJobRecord {
  id: string;
  status: string;
  mode: "FAST" | "BALANCED" | "ACCURATE";
  languageHints: unknown;
  context: unknown;
  options: unknown;
  audioPath: string | null;
}

export interface PipelineDb {
  transcriptionJob: {
    findUnique(args: { where: { id: string } }): Promise<PipelineJobRecord | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  providerCall: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface PipelineDeps {
  db?: PipelineDb;
  config?: Pick<
    Config,
    | "OPENROUTER_API_KEY"
    | "OPENROUTER_STT_MODEL"
    | "OPENROUTER_BASE_URL"
    | "ANTHROPIC_API_KEY"
    | "CLAUDE_REFINER_MODEL"
    | "MAX_AUDIO_DURATION_SEC"
    | "RETAIN_AUDIO_DEFAULT"
    | "CONFIDENCE_FALLBACK_THRESHOLD"
  >;
  preprocess?: typeof preprocessAudio;
  toWav?: typeof pcmToWav;
  sttProvider?: SttProvider;
  refine?: (input: RefineInput) => Promise<RefineResult>;
  removeFile?: (filePath: string) => Promise<void>;
  makeWorkDir?: () => Promise<string>;
}

export class PipelineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildPromptContext(context: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof context.domain === "string" && context.domain) parts.push(context.domain);
  const keywords = stringArray(context.keywords);
  if (keywords.length) parts.push(keywords.join(", "));
  return parts.length ? parts.join(". ") : undefined;
}

function collectLanguages(result: SttResult, segments: TranscriptSegment[]): string[] {
  const set = new Set<string>();
  if (result.language) set.add(result.language);
  for (const s of segments) if (s.language) set.add(s.language);
  return [...set];
}

const GENERIC_PIPELINE_MESSAGE = "Transcription failed due to an internal error";

/** Redacts API-key-looking tokens before anything is logged. */
function redactSecrets(text: string): string {
  return text.replace(/\b(sk|key|rk)-[A-Za-z0-9_*.-]{4,}/g, "$1-***");
}

/** Full detail for server-side logs only; never persisted or returned to clients. */
function errorDetail(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

/**
 * Maps a raw provider SDK error (OpenAI/Anthropic) to a client-safe message.
 * Based on HTTP status / error code only; the raw message is never exposed.
 */
export function sanitizeProviderError(err: unknown, provider: "stt" | "refine"): string {
  const label = provider === "stt" ? "Speech-to-text provider" : "Transcript refiner";
  const e = (typeof err === "object" && err !== null ? err : {}) as {
    status?: unknown;
    code?: unknown;
  };
  const status = typeof e.status === "number" ? e.status : undefined;
  const code = typeof e.code === "string" ? e.code : undefined;
  if (status === 401 || status === 403) return `${label} is not authorized`;
  if (status === 429 || code === "rate_limit_exceeded" || code === "insufficient_quota") {
    return `${label} is rate limited or over quota; try again later`;
  }
  if (status === 413) return `${label} rejected the audio as too large`;
  if (status !== undefined && status >= 400 && status < 500) {
    return `${label} rejected the request`;
  }
  if (
    (status !== undefined && status >= 500) ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  ) {
    return `${label} is temporarily unavailable`;
  }
  return `${label} request failed`;
}

function toErrorInfo(err: unknown): { code: string; message: string } {
  if (isAudioPreprocessError(err)) return { code: err.code, message: err.message };
  if (err instanceof PipelineError) return { code: err.code, message: err.message };
  return { code: "PIPELINE_ERROR", message: GENERIC_PIPELINE_MESSAGE };
}

/**
 * Runs the v1 transcription pipeline for a queued job:
 * preprocess → primary STT → (refine unless FAST) → persist → cleanup.
 * Never throws for pipeline failures; they are recorded on the job row.
 */
export async function runTranscriptionJob(
  jobId: string,
  deps: PipelineDeps = {},
): Promise<void> {
  const db = deps.db ?? (prisma as unknown as PipelineDb);
  const config = deps.config ?? loadConfig();
  const preprocess = deps.preprocess ?? preprocessAudio;
  const toWav = deps.toWav ?? pcmToWav;
  const removeFile = deps.removeFile ?? ((p: string) => fs.rm(p, { force: true }));
  const makeWorkDir =
    deps.makeWorkDir ?? (() => fs.mkdtemp(path.join(os.tmpdir(), "stt-job-")));

  const jobStarted = Date.now();
  const job = await db.transcriptionJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logMetric("job.not_found", { jobId });
    throw new PipelineError("JOB_NOT_FOUND", `Transcription job ${jobId} not found`);
  }
  if (job.status === "completed" || job.status === "failed") {
    logMetric("job.skipped", { jobId, status: job.status });
    return;
  }

  await db.transcriptionJob.update({
    where: { id: jobId },
    data: { status: "processing", errorCode: null, errorMessage: null },
  });

  const options = asRecord(job.options);
  const retainAudio =
    typeof options.retainAudio === "boolean"
      ? options.retainAudio
      : config.RETAIN_AUDIO_DEFAULT;
  const timestamps = options.timestamps !== false;
  const languageHints = stringArray(job.languageHints);
  const context = asRecord(job.context);

  const deleteAudioFile = async (): Promise<void> => {
    if (!job.audioPath) return;
    try {
      await removeFile(job.audioPath);
    } catch (err) {
      logMetric("audio.delete_failed", { jobId, error: errorDetail(err) });
    }
  };

  let workDir: string | undefined;
  const deleteAudio = !retainAudio;
  try {
    if (!job.audioPath) {
      throw new PipelineError("NO_AUDIO", "Job has no audio file");
    }

    workDir = await makeWorkDir();
    const { pcmPath, durationSec } = await preprocess(
      job.audioPath,
      workDir,
      config.MAX_AUDIO_DURATION_SEC,
    );
    const wavPath = await toWav(pcmPath, path.join(workDir, "output.wav"));

    const stt =
      deps.sttProvider ??
      createOpenRouterSttProvider(config.OPENROUTER_API_KEY, {
        model: config.OPENROUTER_STT_MODEL,
        baseUrl: config.OPENROUTER_BASE_URL,
      });
    let sttResult: SttResult;
    try {
      sttResult = await stt.transcribe({
        audioPath: wavPath,
        languageHints,
        promptContext: mergePromptContext(languageHints, buildPromptContext(context)),
        timestamps,
      });
    } catch (err) {
      await db.providerCall.create({
        data: {
          jobId,
          provider: stt.name,
          operation: "transcribe",
          latencyMs: 0,
          success: false,
        },
      });
      logMetric("stt.failed", { jobId, provider: stt.name, error: errorDetail(err) });
      throw new PipelineError("STT_FAILED", sanitizeProviderError(err, "stt"));
    }

    await db.providerCall.create({
      data: {
        jobId,
        provider: stt.name,
        operation: "transcribe",
        latencyMs: Math.round(sttResult.latencyMs),
        costUsdEstimate: sttResult.costUsdEstimate ?? null,
        success: true,
      },
    });
    logMetric("stt.completed", {
      jobId,
      provider: stt.name,
      latencyMs: sttResult.latencyMs,
      durationSec,
    });

    let text = sttResult.text;
    let segments = sttResult.segments;

    if (job.mode !== "FAST") {
      const decision = shouldRefine({
        text,
        confidence: sttResult.confidence,
        languageHints,
        threshold: config.CONFIDENCE_FALLBACK_THRESHOLD,
      });
      if (!decision.refine) {
        logMetric("refine.skipped", { jobId, reason: decision.reason });
      } else {
        const refine =
          deps.refine ??
          createClaudeRefiner(config.ANTHROPIC_API_KEY, {
            model: config.CLAUDE_REFINER_MODEL,
          }).refineTranscript;
        const refineStarted = Date.now();
        try {
          const dictionaryTerms = dictionaryTermsForHints(languageHints);
          const refined = await refine({
            text,
            segments,
            languageHints,
            context: {
              domain: typeof context.domain === "string" ? context.domain : undefined,
              keywords: stringArray(context.keywords),
            },
            ...(dictionaryTerms ? { dictionaryTerms } : {}),
          });
          const latencyMs = Date.now() - refineStarted;
          await db.providerCall.create({
            data: {
              jobId,
              provider: "claude-refiner",
              operation: "refine",
              latencyMs,
              success: true,
            },
          });
          logMetric("refine.completed", { jobId, provider: "claude-refiner", latencyMs });
          text = refined.text;
          segments = refined.segments;
        } catch (err) {
          const latencyMs = Date.now() - refineStarted;
          await db.providerCall.create({
            data: {
              jobId,
              provider: "claude-refiner",
              operation: "refine",
              latencyMs,
              success: false,
            },
          });
          logMetric("refine.failed", {
            jobId,
            provider: "claude-refiner",
            latencyMs,
            error: errorDetail(err),
          });
          // Graceful degradation: keep the raw STT text/segments and still complete the job.
          logMetric("refine.fallback", { jobId, provider: "claude-refiner" });
        }
      }
    }

    const normalized = normalizeSegments(segments);

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        text,
        confidence: sttResult.confidence ?? null,
        languages: collectLanguages(sttResult, normalized),
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        ...(deleteAudio ? { audioPath: null } : {}),
        segments: {
          deleteMany: {},
          create: normalized.map((s, ord) => ({
            startMs: s.startMs,
            endMs: s.endMs,
            text: s.text,
            confidence: s.confidence ?? null,
            speakerId: s.speakerId ?? null,
            language: s.language ?? null,
            ord,
          })),
        },
      },
    });

    if (deleteAudio) await deleteAudioFile();

    logMetric("job.completed", {
      jobId,
      provider: stt.name,
      latencyMs: Date.now() - jobStarted,
      mode: job.mode,
    });
  } catch (err) {
    const { code, message } = toErrorInfo(err);
    logMetric("job.failed", {
      jobId,
      latencyMs: Date.now() - jobStarted,
      errorCode: code,
      error: errorDetail(err),
    });
    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorCode: code,
        errorMessage: message,
        completedAt: new Date(),
        ...(deleteAudio ? { audioPath: null } : {}),
      },
    });
    // Failed jobs are terminal (never retried), so audio is deleted unless retainAudio is set.
    if (deleteAudio) await deleteAudioFile();
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
