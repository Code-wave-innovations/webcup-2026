import assert from "node:assert/strict";
import { test } from "node:test";

function ensureTestEnv(): void {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/stt";
  process.env.STT_API_KEY ??= "test-stt-api-key-12345678";
  process.env.OPENROUTER_API_KEY ??= "sk-or-test-openrouter-key";
  process.env.OPENAI_API_KEY ??= "sk-test-openai-key";
  process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-anthropic-key";
}

test("GET /v1/transcriptions/:id without key returns 401", async () => {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");

  const app = await buildApp(loadConfig());
  const res = await app.inject({
    method: "GET",
    url: "/v1/transcriptions/00000000-0000-0000-0000-000000000001",
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});
