import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AudioPreprocessError } from "../src/modules/audio/preprocess.js";
import {
  runTranscriptionJob,
  type PipelineDb,
  type PipelineDeps,
  type PipelineJobRecord,
  sanitizeProviderError,
} from "../src/modules/pipeline/run-transcription.js";
import { normalizeSegments } from "../src/modules/timestamps/normalize.js";
import type { SttProvider } from "../src/modules/stt/types.js";
import { setMetricSink } from "../src/lib/metrics.js";

const config = {
  OPENAI_API_KEY: "x",
  ANTHROPIC_API_KEY: "y",
  MAX_AUDIO_DURATION_SEC: 7200,
  RETAIN_AUDIO_DEFAULT: false,
};

function makeHarness(jobOverrides: Partial<PipelineJobRecord> = {}) {
  const job: PipelineJobRecord = {
    id: "job-1",
    status: "queued",
    mode: "BALANCED",
    languageHints: ["fr"],
    context: { domain: "tech", keywords: ["API"] },
    options: {},
    audioPath: "/tmp/in.mp3",
    ...jobOverrides,
  };
  const updates: Record<string, unknown>[] = [];
  const calls: Record<string, unknown>[] = [];
  const db: PipelineDb = {
    transcriptionJob: {
      findUnique: async () => job,
      update: async ({ data }) => {
        updates.push(data);
        return {};
      },
    },
    providerCall: {
      create: async ({ data }) => {
        calls.push(data);
        return {};
      },
    },
  };
  const removed: string[] = [];
  const stt: SttProvider & { inputs: unknown[] } = {
    name: "fake-stt",
    inputs: [],
    async transcribe(input) {
      this.inputs.push(input);
      return {
        text: "bonjour monde",
        language: "fr",
        confidence: 0.9,
        latencyMs: 12,
        segments: [
          { startMs: 500, endMs: 900, text: "monde" },
          { startMs: 0, endMs: 400, text: "bonjour" },
        ],
      };
    },
  };
  const deps: PipelineDeps = {
    db,
    config,
    preprocess: async (_in, workDir) => ({
      pcmPath: path.join(workDir, "output.pcm"),
      durationSec: 1,
    }),
    toWav: async (_pcm, wav) => wav ?? "out.wav",
    sttProvider: stt,
    refine: async (input) => ({
      text: "Bonjour, monde.",
      segments: input.segments.map((s) => ({ ...s, text: s.text + "!" })),
    }),
    removeFile: async (p) => {
      removed.push(p);
    },
  };
  return { job, updates, calls, removed, stt, deps };
}

test("normalizeSegments sorts, clamps and removes overlaps", () => {
  const out = normalizeSegments([
    { startMs: 500, endMs: 300, text: " b " },
    { startMs: -10, endMs: 400, text: "a" },
    { startMs: 100, endMs: 200, text: "  " },
  ]);
  assert.deepEqual(out, [
    { startMs: 0, endMs: 400, text: "a" },
    { startMs: 500, endMs: 500, text: "b" },
  ]);
});

test("BALANCED job: STT on wav, refine, persist, delete audio", async () => {
  const restore = setMetricSink(() => {});
  try {
    const h = makeHarness();
    await runTranscriptionJob("job-1", h.deps);

    const input = h.stt.inputs[0] as { audioPath: string; languageHints: string[] };
    assert.ok(input.audioPath.endsWith(".wav"));
    assert.deepEqual(input.languageHints, ["fr"]);

    assert.deepEqual(
      h.calls.map((c) => [c.provider, c.operation, c.success]),
      [
        ["fake-stt", "transcribe", true],
        ["claude-refiner", "refine", true],
      ],
    );

    assert.equal(h.updates[0].status, "processing");
    const final = h.updates.at(-1)!;
    assert.equal(final.status, "completed");
    assert.equal(final.text, "Bonjour, monde.");
    assert.equal(final.audioPath, null);
    assert.deepEqual(final.languages, ["fr"]);
    const created = (final.segments as { create: { text: string; ord: number }[] }).create;
    assert.deepEqual(created.map((s) => [s.ord, s.text]), [[0, "bonjour!"], [1, "monde!"]]);
    assert.deepEqual(h.removed, ["/tmp/in.mp3"]);
  } finally {
    restore();
  }
});

test("FAST job skips refine; retainAudio keeps the file", async () => {
  const restore = setMetricSink(() => {});
  try {
    const h = makeHarness({ mode: "FAST", options: { retainAudio: true } });
    h.deps.refine = async () => {
      throw new Error("should not be called");
    };
    await runTranscriptionJob("job-1", h.deps);

    assert.equal(h.calls.length, 1);
    const final = h.updates.at(-1)!;
    assert.equal(final.status, "completed");
    assert.equal(final.text, "bonjour monde");
    assert.ok(!("audioPath" in final));
    assert.deepEqual(h.removed, []);
  } finally {
    restore();
  }
});

test("preprocess failure marks job failed with error code", async () => {
  const restore = setMetricSink(() => {});
  try {
    const h = makeHarness();
    h.deps.preprocess = async () => {
      throw new AudioPreprocessError("AUDIO_TOO_LARGE", "too long");
    };
    await runTranscriptionJob("job-1", h.deps);

    const final = h.updates.at(-1)!;
    assert.equal(final.status, "failed");
    assert.equal(final.errorCode, "AUDIO_TOO_LARGE");
    assert.equal(final.errorMessage, "too long");
    assert.equal(h.calls.length, 0);
    assert.equal(final.audioPath, null);
    assert.deepEqual(h.removed, ["/tmp/in.mp3"]);
  } finally {
    restore();
  }
});

test("STT failure records failed ProviderCall and sanitized job error", async () => {
  const restore = setMetricSink(() => {});
  try {
    const a = makeHarness();
    a.stt.transcribe = async () => {
      throw new Error("boom");
    };
    await runTranscriptionJob("job-1", a.deps);
    const final = a.updates.at(-1)!;
    assert.equal(final.status, "failed");
    assert.equal(final.errorCode, "STT_FAILED");
    assert.equal(a.calls[0].success, false);
    assert.deepEqual(a.removed, ["/tmp/in.mp3"]);
    assert.equal(final.audioPath, null);
  } finally {
    restore();
  }
});

test("provider error messages are sanitized (no raw message persisted) and logged server-side", async () => {
  const lines: string[] = [];
  const restore = setMetricSink((l) => lines.push(l));
  try {
    const secret = "Incorrect API key provided: sk-proj-abcdef123456. Account org-SECRET";
    const err = Object.assign(new Error(secret), { status: 401, code: "invalid_api_key" });
    const h = makeHarness();
    h.stt.transcribe = async () => {
      throw err;
    };
    await runTranscriptionJob("job-1", h.deps);
    const final = h.updates.at(-1)!;
    assert.equal(final.status, "failed");
    assert.equal(final.errorCode, "STT_FAILED");
    assert.equal(final.errorMessage, "Speech-to-text provider is not authorized");
    assert.ok(!String(final.errorMessage).includes("sk-"));
    assert.ok(!String(final.errorMessage).includes("SECRET"));

    // detail stays server-side, with the key redacted
    const logged = lines.join("\n");
    assert.ok(logged.includes("Incorrect API key provided"));
    assert.ok(!logged.includes("abcdef123456"));

    assert.equal(sanitizeProviderError(Object.assign(new Error("x"), { status: 429 }), "stt"),
      "Speech-to-text provider is rate limited or over quota; try again later");
    assert.equal(sanitizeProviderError(Object.assign(new Error("x"), { status: 503 }), "stt"),
      "Speech-to-text provider is temporarily unavailable");
    assert.equal(sanitizeProviderError(new Error("anything secret"), "stt"),
      "Speech-to-text provider request failed");

    // unexpected non-provider errors also get a generic message
    const g = makeHarness();
    g.deps.toWav = async () => {
      throw new Error("ffmpeg exited: /var/secret/path");
    };
    await runTranscriptionJob("job-1", g.deps);
    const gf = g.updates.at(-1)!;
    assert.equal(gf.errorCode, "PIPELINE_ERROR");
    assert.ok(!String(gf.errorMessage).includes("secret"));
  } finally {
    restore();
  }
});

test("failed job keeps audio when retainAudio is true", async () => {
  const restore = setMetricSink(() => {});
  try {
    const h = makeHarness({ options: { retainAudio: true } });
    h.stt.transcribe = async () => {
      throw new Error("boom");
    };
    await runTranscriptionJob("job-1", h.deps);
    const final = h.updates.at(-1)!;
    assert.equal(final.status, "failed");
    assert.ok(!("audioPath" in final));
    assert.deepEqual(h.removed, []);
  } finally {
    restore();
  }
});

test("refine failure falls back to raw STT text/segments and still completes", async () => {
  const restore = setMetricSink(() => {});
  try {
    const b = makeHarness();
    b.deps.refine = async () => {
      throw new Error("bad json from anthropic");
    };
    await runTranscriptionJob("job-1", b.deps);
    const final = b.updates.at(-1)!;
    assert.equal(final.status, "completed");
    assert.equal(final.text, "bonjour monde");
    assert.equal(final.errorCode, null);
    assert.equal(final.errorMessage, null);
    assert.equal(final.confidence, 0.9);
    const created = (final.segments as { create: { text: string }[] }).create;
    assert.deepEqual(created.map((s) => s.text), ["bonjour", "monde"]);
    assert.equal(b.calls.at(-1)!.success, false);
    assert.equal(b.calls.at(-1)!.operation, "refine");
    assert.deepEqual(b.removed, ["/tmp/in.mp3"]);
  } finally {
    restore();
  }
});

test("temp work dir is cleaned up", async () => {
  const restore = setMetricSink(() => {});
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stt-test-"));
  try {
    const h = makeHarness();
    h.deps.makeWorkDir = async () => dir;
    await runTranscriptionJob("job-1", h.deps);
    await assert.rejects(() => fs.stat(dir));
  } finally {
    restore();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
