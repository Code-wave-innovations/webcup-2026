import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_OPENROUTER_STT_MODEL,
  OPENROUTER_STT_PROVIDER_NAME,
  OpenRouterSttError,
  createOpenRouterSttProvider,
} from "../src/modules/stt/providers/openrouter-stt.js";

test("createOpenRouterSttProvider posts base64 audio to OpenRouter", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = createOpenRouterSttProvider("sk-or-test", {
    baseUrl: "https://openrouter.test/api/v1",
    readFile: async () => Buffer.from("fake-wav-bytes"),
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init as RequestInit });
      return new Response(JSON.stringify({ text: "bonjour" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(provider.name, OPENROUTER_STT_PROVIDER_NAME);

  const result = await provider.transcribe({
    audioPath: "/tmp/sample.wav",
    timestamps: false,
    languageHints: ["fr"],
  });

  assert.equal(result.text, "bonjour");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://openrouter.test/api/v1/audio/transcriptions");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sk-or-test");
  const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
  assert.equal(body.model, DEFAULT_OPENROUTER_STT_MODEL);
  assert.equal(body.language, "fr");
  assert.equal(body.response_format, "json");
  const audio = body.input_audio as { data: string; format: string };
  assert.equal(audio.format, "wav");
  assert.equal(audio.data, Buffer.from("fake-wav-bytes").toString("base64"));
});

test("createOpenRouterSttProvider omits language for mg and prompts Malagasy", async () => {
  const calls: unknown[] = [];
  const provider = createOpenRouterSttProvider("sk-or-test", {
    readFile: async () => Buffer.from("x"),
    fetch: async (_url, init) => {
      calls.push(JSON.parse(String((init as RequestInit).body)));
      return new Response(JSON.stringify({ text: "Manao ahoana" }), { status: 200 });
    },
  });

  await provider.transcribe({
    audioPath: "/tmp/sample.webm",
    timestamps: false,
    languageHints: ["mg"],
  });

  const body = calls[0] as Record<string, unknown>;
  assert.equal(body.language, undefined);
  assert.match(String(body.prompt), /Manao ahoana|Misaotra/i);
  assert.equal((body.input_audio as { format: string }).format, "webm");
});

test("createOpenRouterSttProvider rejects raw PCM paths", async () => {
  const provider = createOpenRouterSttProvider("sk-or-test", {
    fetch: async () => new Response("{}", { status: 200 }),
  });

  await assert.rejects(
    () => provider.transcribe({ audioPath: "/tmp/out.pcm" }),
    (err: unknown) => err instanceof OpenRouterSttError,
  );
});

test("createOpenRouterSttProvider surfaces API errors", async () => {
  const provider = createOpenRouterSttProvider("sk-or-test", {
    readFile: async () => Buffer.from("x"),
    fetch: async () =>
      new Response(JSON.stringify({ error: { message: "bad audio" } }), { status: 400 }),
  });

  await assert.rejects(
    () => provider.transcribe({ audioPath: "/tmp/a.wav", timestamps: false }),
    (err: unknown) => {
      assert.ok(err instanceof OpenRouterSttError);
      assert.match(err.message, /bad audio/);
      return true;
    },
  );
});
