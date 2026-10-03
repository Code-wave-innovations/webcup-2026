import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

function ensureTestEnv(): void {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/stt";
  process.env.STT_API_KEY ??= "test-stt-api-key-12345678";
  process.env.OPENAI_API_KEY ??= "sk-test-openai-key";
  process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-anthropic-key";
}

type Row = Record<string, any>;

async function harness(opts: { duration?: number; publishError?: Error } = {}) {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const config = loadConfig();
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "stt-up-"));

  const rows = new Map<string, Row>();
  const published: string[] = [];
  const ran: string[] = [];

  const app = await buildApp(config, {
    uploadDir,
    probeDuration: async () => opts.duration ?? 5,
    db: {
      transcriptionJob: {
        create: async ({ data }) => {
          const row = {
            text: null,
            confidence: null,
            speakers: null,
            errorCode: null,
            errorMessage: null,
            completedAt: null,
            createdAt: new Date("2026-10-03T08:00:00Z"),
            segments: [],
            ...data,
          };
          rows.set(row.id as string, row);
          return row;
        },
        update: async ({ where, data }) => {
          Object.assign(rows.get(where.id)!, data);
          return rows.get(where.id);
        },
        findUnique: async ({ where }) => (rows.get(where.id) as any) ?? null,
      },
    },
    publish: async (id) => {
      if (opts.publishError) throw opts.publishError;
      published.push(id);
    },
    runJob: async (id) => {
      ran.push(id);
      Object.assign(rows.get(id)!, {
        status: "completed",
        text: "bonjour",
        languages: ["fr"],
        confidence: 0.9,
        completedAt: new Date("2026-10-03T08:00:01Z"),
        segments: [
          { startMs: 0, endMs: 500, text: "bonjour", confidence: 0.9, speakerId: null, language: "fr", ord: 0 },
        ],
      });
    },
  });
  return { app, config, rows, published, ran, uploadDir };
}

function multipartBody(fields: Record<string, string>, withAudio = true) {
  const boundary = "----sttboundary";
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      ),
    );
  }
  if (withAudio) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
      ),
      Buffer.from("RIFFfakeaudio"),
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

test("POST /v1/transcriptions without key returns 401", async () => {
  const { app } = await harness();
  const { payload, contentType } = multipartBody({});
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: { "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("POST short audio runs inline and returns 200 TranscriptionResponse", async () => {
  const { app, config, ran, published, uploadDir } = await harness();
  const { payload, contentType } = multipartBody({
    mode: "FAST",
    languageHints: '["fr"]',
    context: '{"domain":"tech","keywords":["API"]}',
    options: "{}",
  });
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: { authorization: `Bearer ${config.STT_API_KEY}`, "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.match(body.id, /^[0-9a-f-]{36}$/);
  assert.equal(body.status, "completed");
  assert.equal(body.mode, "FAST");
  assert.equal(body.text, "bonjour");
  assert.deepEqual(body.languages, ["fr"]);
  assert.equal(body.confidence, 0.9);
  assert.deepEqual(body.segments, [
    { startMs: 0, endMs: 500, text: "bonjour", confidence: 0.9, language: "fr" },
  ]);
  assert.equal(body.createdAt, "2026-10-03T08:00:00.000Z");
  assert.equal(body.completedAt, "2026-10-03T08:00:01.000Z");
  assert.deepEqual(ran, [body.id]);
  assert.deepEqual(published, []);
  assert.equal((await fs.readdir(uploadDir)).length, 1);

  const get = await app.inject({
    method: "GET",
    url: `/v1/transcriptions/${body.id}`,
    headers: { authorization: `Bearer ${config.STT_API_KEY}` },
  });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().id, body.id);
  await app.close();
});

test("POST with options.async=true publishes and returns 202 queued", async () => {
  const { app, config, ran, published } = await harness();
  const { payload, contentType } = multipartBody({ options: '{"async":true}' });
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: { authorization: `Bearer ${config.STT_API_KEY}`, "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 202, res.body);
  const body = res.json();
  assert.equal(body.status, "queued");
  assert.equal(body.mode, "BALANCED");
  assert.deepEqual(published, [body.id]);
  assert.deepEqual(ran, []);
  await app.close();
});

test("POST long audio (> threshold) is queued with 202", async () => {
  const { app, config, published } = await harness({ duration: 99_999 });
  const { payload, contentType } = multipartBody({});
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: { authorization: `Bearer ${config.STT_API_KEY}`, "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 202);
  assert.equal(published.length, 1);
  await app.close();
});

test("POST validation errors return 400", async () => {
  const { app, config, rows } = await harness();
  const headers = (ct: string) => ({
    authorization: `Bearer ${config.STT_API_KEY}`,
    "content-type": ct,
  });

  for (const fields of [{ mode: "TURBO" }, { languageHints: "not-json" }, { options: '{"async":"yes"}' }]) {
    const { payload, contentType } = multipartBody(fields);
    const res = await app.inject({
      method: "POST",
      url: "/v1/transcriptions",
      headers: headers(contentType),
      payload,
    });
    assert.equal(res.statusCode, 400, JSON.stringify(fields));
    assert.equal(res.json().error.code, "INVALID_REQUEST");
  }

  const noAudio = multipartBody({}, false);
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: headers(noAudio.contentType),
    payload: noAudio.payload,
  });
  assert.equal(res.statusCode, 400);
  assert.equal(rows.size, 0);
  await app.close();
});

test("GET unknown id returns 404; health stays public", async () => {
  const { app, config } = await harness();
  const res = await app.inject({
    method: "GET",
    url: "/v1/transcriptions/00000000-0000-0000-0000-000000000001",
    headers: { authorization: `Bearer ${config.STT_API_KEY}` },
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error.code, "NOT_FOUND");

  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  await app.close();
});

test("publish failure marks job failed, deletes upload and returns 502", async () => {
  const { app, config, rows, published, uploadDir } = await harness({
    publishError: new Error("amqp://guest:guest@broker ECONNREFUSED"),
  });
  const { payload, contentType } = multipartBody({ options: '{"async":true}' });
  const res = await app.inject({
    method: "POST",
    url: "/v1/transcriptions",
    headers: { authorization: `Bearer ${config.STT_API_KEY}`, "content-type": contentType },
    payload,
  });
  assert.equal(res.statusCode, 502, res.body);
  assert.equal(res.json().error.code, "QUEUE_UNAVAILABLE");
  assert.ok(!res.body.includes("amqp"));
  assert.deepEqual(published, []);
  assert.equal(rows.size, 1);
  const row = [...rows.values()][0];
  assert.equal(row.status, "failed");
  assert.equal(row.errorCode, "QUEUE_UNAVAILABLE");
  assert.ok(!String(row.errorMessage).includes("amqp"));
  assert.equal(row.audioPath, null);
  assert.deepEqual(await fs.readdir(uploadDir), []);
  await app.close();
});
