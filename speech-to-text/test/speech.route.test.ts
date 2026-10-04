import assert from "node:assert/strict";
import { test } from "node:test";
import type { SpeechProvider } from "../src/modules/tts/swiftask-speech.js";
import type { SpeechCache } from "../src/modules/tts/speech-cache.js";
import { createCharBudget } from "../src/modules/tts/speech-cache.js";

function ensureTestEnv(): void {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/stt";
  process.env.STT_API_KEY ??= "test-stt-api-key-12345678";
  process.env.OPENROUTER_API_KEY ??= "sk-or-test-openrouter-key";
  process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-anthropic-key";
}

function memoryCache(): SpeechCache & { store: Map<string, Buffer> } {
  const store = new Map<string, Buffer>();
  return { store, get: async (key) => store.get(key) ?? null, set: async (key, audio) => void store.set(key, audio) };
}

function fakeProvider(calls: string[]): SpeechProvider {
  return {
    id: "fake",
    async stream(text) {
      calls.push(text);
      return (async function* () {
        yield new TextEncoder().encode("ID3");
        yield new TextEncoder().encode(`:${text}`);
      })();
    },
  };
}

async function setup(deps: { speechProvider?: SpeechProvider | null; speechCache?: SpeechCache } = {}) {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const app = await buildApp(loadConfig(), deps);
  const res = await app.inject({ method: "POST", url: "/v1/realtime/tokens" });
  const { token } = res.json() as { token: string };
  const url = (text: string, t = token) => `/v1/speech?text=${encodeURIComponent(text)}&token=${encodeURIComponent(t)}`;
  return { app, url };
}

test("GET /v1/speech streams the voice, then serves it from the cache", async () => {
  const calls: string[] = [];
  const cache = memoryCache();
  const { app, url } = await setup({ speechProvider: fakeProvider(calls), speechCache: cache });

  const first = await app.inject({ method: "GET", url: url("Bienvenue à Terra Nova.") });
  assert.equal(first.statusCode, 200);
  assert.match(String(first.headers["content-type"]), /audio\/mpeg/);
  assert.equal(first.body, "ID3:Bienvenue à Terra Nova.");
  assert.equal(cache.store.size, 1);

  const second = await app.inject({ method: "GET", url: url("Bienvenue à Terra Nova.") });
  assert.equal(second.body, "ID3:Bienvenue à Terra Nova.");
  assert.deepEqual(calls, ["Bienvenue à Terra Nova."]);
  await app.close();
});

test("GET /v1/speech refuses a bad token, an empty text and a missing provider", async () => {
  const { app, url } = await setup({ speechProvider: fakeProvider([]), speechCache: memoryCache() });
  assert.equal((await app.inject({ method: "GET", url: url("Bonjour", "a.b.c") })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: url("   ") })).statusCode, 400);
  assert.equal((await app.inject({ method: "GET", url: url("x".repeat(601)) })).statusCode, 400);
  await app.close();

  const off = await setup({ speechProvider: null, speechCache: memoryCache() });
  const res = await off.app.inject({ method: "GET", url: off.url("Bonjour") });
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error.code, "TTS_NOT_CONFIGURED");
  await off.app.close();
});

test("GET /v1/speech answers 502 when the provider fails", async () => {
  const failing: SpeechProvider = { id: "down", stream: async () => Promise.reject(new Error("down")) };
  const { app, url } = await setup({ speechProvider: failing, speechCache: memoryCache() });
  assert.equal((await app.inject({ method: "GET", url: url("Bonjour") })).statusCode, 502);
  await app.close();
});

test("the character budget slides over one minute", () => {
  let now = 0;
  const budget = createCharBudget(100, () => now);
  assert.equal(budget.take(80), true);
  assert.equal(budget.take(30), false);
  now = 60_001;
  assert.equal(budget.take(30), true);
});
