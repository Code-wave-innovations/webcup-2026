import assert from "node:assert/strict";
import { test } from "node:test";
import type { TranscriptionVerbose } from "openai/resources/audio/transcriptions.js";
import {
  GPT_TRANSCRIBE_MODEL,
  GPT_TRANSCRIBE_PROVIDER_NAME,
  GptTranscribeError,
  WHISPER_TIMESTAMP_MODEL,
  createGptTranscribeProvider,
  mapGptTranscriptionToSttResult,
} from "../src/modules/stt/providers/gpt-transcribe.js";

const verboseFixture: TranscriptionVerbose = {
  duration: 2.5,
  language: "fr",
  text: "Bonjour le monde",
  segments: [
    {
      id: 0,
      seek: 0,
      start: 0,
      end: 1.2,
      text: " Bonjour",
      tokens: [],
      temperature: 0,
      avg_logprob: -0.2,
      compression_ratio: 1.1,
      no_speech_prob: 0.01,
    },
    {
      id: 1,
      seek: 0,
      start: 1.2,
      end: 2.4,
      text: " le monde",
      tokens: [],
      temperature: 0,
      avg_logprob: -0.4,
      compression_ratio: 1.0,
      no_speech_prob: 0.02,
    },
  ],
};

test("mapGptTranscriptionToSttResult maps verbose_json segments to ms", () => {
  const result = mapGptTranscriptionToSttResult(verboseFixture, 42);

  assert.equal(result.text, "Bonjour le monde");
  assert.equal(result.language, "fr");
  assert.equal(result.latencyMs, 42);
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].startMs, 0);
  assert.equal(result.segments[0].endMs, 1200);
  assert.equal(result.segments[0].text, "Bonjour");
  assert.equal(result.segments[1].startMs, 1200);
  assert.equal(result.segments[1].endMs, 2400);
  assert.ok(result.segments[0].confidence !== undefined);
  assert.ok(result.confidence !== undefined);
});

test("mapGptTranscriptionToSttResult maps plain json to single segment", () => {
  const result = mapGptTranscriptionToSttResult({ text: "hello" }, 10);

  assert.equal(result.text, "hello");
  assert.deepEqual(result.segments, [
    { startMs: 0, endMs: 0, text: "hello" },
  ]);
});

test("createGptTranscribeProvider uses gpt-4o-transcribe when timestamps disabled", async () => {
  const calls: unknown[] = [];
  const provider = createGptTranscribeProvider("sk-test", {
    createReadStream: () => ({}) as ReturnType<typeof import("node:fs").createReadStream>,
    client: {
      audio: {
        transcriptions: {
          create: async (body: unknown) => {
            calls.push(body);
            return { text: "ok" };
          },
        },
      },
    },
  });

  assert.equal(provider.name, GPT_TRANSCRIBE_PROVIDER_NAME);

  const result = await provider.transcribe({
    audioPath: "/tmp/sample.wav",
    timestamps: false,
    languageHints: ["en"],
    promptContext: "ERP terms",
  });

  assert.equal(result.text, "ok");
  assert.equal(calls.length, 1);
  const body = calls[0] as Record<string, unknown>;
  assert.equal(body.model, GPT_TRANSCRIBE_MODEL);
  assert.equal(body.response_format, "json");
  assert.equal(body.language, "en");
  assert.equal(body.prompt, "ERP terms");
  assert.equal(body.timestamp_granularities, undefined);
});

test("createGptTranscribeProvider uses whisper verbose_json when timestamps enabled", async () => {
  const calls: unknown[] = [];
  const provider = createGptTranscribeProvider("sk-test", {
    createReadStream: () => ({}) as ReturnType<typeof import("node:fs").createReadStream>,
    client: {
      audio: {
        transcriptions: {
          create: async (body: unknown) => {
            calls.push(body);
            return verboseFixture;
          },
        },
      },
    },
  });

  const result = await provider.transcribe({
    audioPath: "/tmp/sample.mp3",
    timestamps: true,
  });

  assert.equal(result.segments.length, 2);
  assert.equal(calls.length, 1);
  const body = calls[0] as Record<string, unknown>;
  assert.equal(body.model, WHISPER_TIMESTAMP_MODEL);
  assert.equal(body.response_format, "verbose_json");
  assert.deepEqual(body.timestamp_granularities, ["segment"]);
});

test("createGptTranscribeProvider rejects raw PCM paths", async () => {
  const provider = createGptTranscribeProvider("sk-test", {
    client: {
      audio: {
        transcriptions: {
          create: async () => ({ text: "nope" }),
        },
      },
    },
  });

  await assert.rejects(
    () => provider.transcribe({ audioPath: "/tmp/output.pcm" }),
    (err: unknown) => {
      assert.ok(err instanceof GptTranscribeError);
      return true;
    },
  );
});
