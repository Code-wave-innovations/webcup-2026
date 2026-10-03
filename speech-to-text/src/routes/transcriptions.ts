import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import { logMetric } from "../lib/metrics.js";
import { prisma } from "../lib/prisma.js";
import { publishTranscriptionJob } from "../lib/rabbitmq.js";
import { probeDurationSec } from "../modules/audio/preprocess.js";
import { runTranscriptionJob } from "../modules/pipeline/run-transcription.js";

export type Mode = "FAST" | "BALANCED" | "ACCURATE";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface SegmentRow {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number | null;
  speakerId: string | null;
  language: string | null;
  ord: number;
}

export interface JobRow {
  id: string;
  status: JobStatus;
  mode: Mode;
  text: string | null;
  languages: unknown;
  confidence: number | null;
  speakers: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  segments?: SegmentRow[];
}

/** Minimal DB surface used by the routes (satisfied by PrismaClient; fakeable in tests). */
export interface TranscriptionRouteDb {
  transcriptionJob: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique(args: {
      where: { id: string };
      include?: { segments: { orderBy: { ord: "asc" } } };
    }): Promise<JobRow | null>;
  };
}

export interface TranscriptionRouteDeps {
  db?: TranscriptionRouteDb;
  publish?: (jobId: string) => Promise<void>;
  runJob?: (jobId: string) => Promise<void>;
  probeDuration?: (filePath: string) => Promise<number>;
  uploadDir?: string;
}

export interface TranscriptionResponse {
  id: string;
  status: JobStatus;
  mode: Mode;
  text?: string;
  languages?: string[];
  confidence?: number;
  segments?: {
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
    speakerId?: string;
    language?: string;
  }[];
  speakers?: { id: string; label?: string }[];
  error?: { code: string; message: string };
  createdAt: string;
  completedAt?: string;
}

const modeSchema = z.enum(["FAST", "BALANCED", "ACCURATE"]);
const languageHintsSchema = z.array(z.string().min(1)).default([]);
const contextSchema = z
  .object({
    domain: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .default({});
const optionsSchema = z
  .object({
    retainAudio: z.boolean().optional(),
    wordTimestamps: z.boolean().optional(),
    dictionaryIds: z.array(z.string()).optional(),
    async: z.boolean().optional(),
  })
  .default({});

const idSchema = z.string().uuid();

/** Assumed bitrate (128 kbps) used to estimate duration when ffprobe is unavailable. */
const FALLBACK_BYTES_PER_SEC = 16_000;

function apiError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

function parseJsonField(raw: string | undefined, name: string): unknown {
  if (raw === undefined || raw === "") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new z.ZodError([
      { code: "custom", path: [name], message: `${name} must be valid JSON` },
    ]);
  }
}

export function toTranscriptionResponse(row: JobRow): TranscriptionResponse {
  const res: TranscriptionResponse = {
    id: row.id,
    status: row.status,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.text != null) res.text = row.text;
  if (Array.isArray(row.languages) && row.languages.length > 0) {
    res.languages = row.languages.filter((l): l is string => typeof l === "string");
  }
  if (row.confidence != null) res.confidence = row.confidence;
  if (row.segments && (row.status === "completed" || row.segments.length > 0)) {
    res.segments = [...row.segments]
      .sort((a, b) => a.ord - b.ord)
      .map((s) => ({
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        ...(s.confidence != null ? { confidence: s.confidence } : {}),
        ...(s.speakerId != null ? { speakerId: s.speakerId } : {}),
        ...(s.language != null ? { language: s.language } : {}),
      }));
  }
  if (Array.isArray(row.speakers) && row.speakers.length > 0) {
    res.speakers = row.speakers as { id: string; label?: string }[];
  }
  if (row.errorCode) {
    res.error = { code: row.errorCode, message: row.errorMessage ?? "" };
  }
  if (row.completedAt) res.completedAt = row.completedAt.toISOString();
  return res;
}

export const transcriptionRoutes =
  (config: Config, deps: TranscriptionRouteDeps = {}): FastifyPluginAsync =>
  async (app) => {
    const db = deps.db ?? (prisma as unknown as TranscriptionRouteDb);
    const publish = deps.publish ?? publishTranscriptionJob;
    const runJob = deps.runJob ?? ((jobId: string) => runTranscriptionJob(jobId));
    const probe = deps.probeDuration ?? probeDurationSec;
    const uploadDir = deps.uploadDir ?? path.resolve(process.cwd(), "uploads");

    const fetchJob = (id: string) =>
      db.transcriptionJob.findUnique({
        where: { id },
        include: { segments: { orderBy: { ord: "asc" } } },
      });

    async function estimateDuration(filePath: string, size: number): Promise<number> {
      try {
        const d = await probe(filePath);
        if (Number.isFinite(d) && d >= 0) return d;
      } catch {
        // ffprobe missing/broken: fall through to size heuristic
      }
      return size / FALLBACK_BYTES_PER_SEC;
    }

    app.post("/v1/transcriptions", async (req, reply) => {
      if (!req.isMultipart()) {
        return apiError(reply, 400, "INVALID_REQUEST", "Expected multipart/form-data");
      }

      const id = randomUUID();
      const fields: Record<string, string> = {};
      let audioPath: string | undefined;
      let audioBytes = 0;

      try {
        await fs.mkdir(uploadDir, { recursive: true });
        for await (const part of req.parts()) {
          if (part.type === "file") {
            if (part.fieldname !== "audio" || audioPath) {
              part.file.resume();
              continue;
            }
            const ext = path.extname(part.filename ?? "").replace(/[^.\w]/g, "").slice(0, 10);
            const target = path.join(uploadDir, `${id}${ext}`);
            audioPath = target;
            await pipeline(part.file, createWriteStream(target));
            if (part.file.truncated) {
              await fs.rm(target, { force: true });
              audioPath = undefined;
              return apiError(
                reply,
                413,
                "AUDIO_TOO_LARGE",
                `Audio exceeds ${config.MAX_AUDIO_BYTES} bytes`,
              );
            }
            audioBytes = (await fs.stat(target)).size;
          } else if (typeof part.value === "string") {
            fields[part.fieldname] = part.value;
          }
        }
      } catch (err) {
        if (audioPath) await fs.rm(audioPath, { force: true }).catch(() => undefined);
        const code = (err as { code?: string }).code;
        if (code === "FST_REQ_FILE_TOO_LARGE") {
          return apiError(reply, 413, "AUDIO_TOO_LARGE", `Audio exceeds ${config.MAX_AUDIO_BYTES} bytes`);
        }
        return apiError(reply, 400, "INVALID_REQUEST", "Malformed multipart body");
      }

      if (!audioPath || audioBytes === 0) {
        if (audioPath) await fs.rm(audioPath, { force: true }).catch(() => undefined);
        return apiError(reply, 400, "INVALID_REQUEST", "Missing 'audio' file field");
      }

      let parsed: {
        mode: Mode;
        languageHints: string[];
        context: z.infer<typeof contextSchema>;
        options: z.infer<typeof optionsSchema>;
      };
      try {
        parsed = {
          mode: modeSchema.default("BALANCED").parse(fields.mode || undefined),
          languageHints: languageHintsSchema.parse(parseJsonField(fields.languageHints, "languageHints")),
          context: contextSchema.parse(parseJsonField(fields.context, "context")),
          options: optionsSchema.parse(parseJsonField(fields.options, "options")),
        };
      } catch (err) {
        await fs.rm(audioPath, { force: true }).catch(() => undefined);
        if (err instanceof z.ZodError) {
          return apiError(
            reply,
            400,
            "INVALID_REQUEST",
            err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
          );
        }
        throw err;
      }

      await db.transcriptionJob.create({
        data: {
          id,
          status: "queued",
          mode: parsed.mode,
          languageHints: parsed.languageHints,
          context: parsed.context,
          options: parsed.options,
          audioPath,
          languages: [],
        },
      });

      const durationSec = await estimateDuration(audioPath, audioBytes);
      const forceAsync = parsed.options.async === true;
      const goAsync = forceAsync || durationSec > config.ASYNC_DURATION_THRESHOLD_SEC;

      logMetric("job.created", { jobId: id, mode: parsed.mode, durationSec, async: goAsync });

      if (goAsync) {
        await publish(id);
        const row = await fetchJob(id);
        return reply.code(202).send(toTranscriptionResponse(row!));
      }

      await runJob(id);
      const row = await fetchJob(id);
      if (!row) return apiError(reply, 500, "INTERNAL", "Job disappeared");
      return reply.code(200).send(toTranscriptionResponse(row));
    });

    app.get<{ Params: { id: string } }>("/v1/transcriptions/:id", async (req, reply) => {
      const notFound = () => apiError(reply, 404, "NOT_FOUND", "Transcription not found");
      if (!idSchema.safeParse(req.params.id).success) return notFound();
      const row = await fetchJob(req.params.id);
      if (!row) return notFound();
      return reply.code(200).send(toTranscriptionResponse(row));
    });
  };
