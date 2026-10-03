import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import WebSocket from "ws";

function ensureTestEnv(): void {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/stt";
  process.env.STT_API_KEY ??= "test-stt-api-key-12345678";
  process.env.OPENROUTER_API_KEY ??= "sk-or-test-openrouter-key";
  process.env.OPENAI_API_KEY ??= "sk-test-openai-key";
  process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-anthropic-key";
}

interface FakeSttResult {
  text: string;
  confidence?: number;
  segments: { startMs: number; endMs: number; text: string }[];
}

async function harness(opts: {
  sttResult?: FakeSttResult;
  refineResult?: { text: string; segments: FakeSttResult["segments"] } | { error: Error };
} = {}) {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const config = loadConfig();

  const sttCalls: string[] = [];
  const fakeStt = {
    name: "fake-stt",
    transcribe: async (input: { audioPath: string }) => {
      sttCalls.push(input.audioPath);
      return {
        text: opts.sttResult?.text ?? "bonjour le monde",
        confidence: opts.sttResult?.confidence ?? 0.9,
        segments: opts.sttResult?.segments ?? [{ startMs: 0, endMs: 500, text: "bonjour le monde" }],
        latencyMs: 5,
      };
    },
  };

  let refineCalls = 0;
  const fakeRefine = async () => {
    refineCalls++;
    const r = opts.refineResult;
    if (r && "error" in r) throw r.error;
    return { text: r?.text ?? "Bonjour le monde !", segments: r?.segments ?? [] };
  };

  const app = await buildApp(config, {
    sttProvider: fakeStt as never,
    refine: fakeRefine as never,
  });
  await app.ready();

  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  // Route the HTTP server's upgrade requests through Fastify's websocket handler.
  server.on("upgrade", (req, sock, head) => {
    (app.server as unknown as { emit: (e: string, ...a: unknown[]) => boolean }).emit(
      "upgrade",
      req,
      sock,
      head,
    );
  });

  const port = address.port;
  const httpBase = `http://127.0.0.1:${port}`;

  async function issueToken(): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/realtime/tokens",
      headers: { authorization: `Bearer ${config.STT_API_KEY}` },
    });
    assert.equal(res.statusCode, 201);
    return (res.json() as { token: string }).token;
  }

  function openSocket(token: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/transcriptions/realtime?token=${token}`);
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve(ws));
      ws.once("error", reject);
    });
  }

  function nextMessage(ws: WebSocket): Promise<Record<string, any>> {
    return new Promise((resolve) => {
      ws.once("message", (data) => resolve(JSON.parse(data.toString())));
    });
  }

  function closedOnce(ws: WebSocket): Promise<{ code: number }> {
    return new Promise((resolve) => {
      ws.once("close", (code) => resolve({ code }));
    });
  }

  return {
    app,
    server,
    config,
    sttCalls,
    refineCalls: () => refineCalls,
    issueToken,
    openSocket,
    nextMessage,
    closedOnce,
    httpBase,
    cleanup: async () => {
      server.close();
      await app.close();
    },
  };
}

async function withSocket(
  opts: Parameters<typeof harness>[0],
  fn: (h: Awaited<ReturnType<typeof harness>>, ws: WebSocket) => Promise<void>,
): Promise<void> {
  const h = await harness(opts);
  try {
    const token = await h.issueToken();
    const ws = await h.openSocket(token);
    await fn(h, ws);
    ws.close();
  } finally {
    await h.cleanup();
  }
}

test("POST /v1/realtime/tokens without key returns 401", async () => {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const app = await buildApp(loadConfig());
  const res = await app.inject({ method: "POST", url: "/v1/realtime/tokens" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("POST /v1/realtime/tokens issues ephemeral token", async () => {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const app = await buildApp(loadConfig());
  const res = await app.inject({
    method: "POST",
    url: "/v1/realtime/tokens",
    headers: { authorization: `Bearer test-stt-api-key-12345678` },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json() as { token: string; expiresAt: string; wsUrl: string };
  assert.equal(body.token.split(".").length, 3);
  assert.equal(body.wsUrl, "/v1/transcriptions/realtime");
  assert.ok(new Date(body.expiresAt).getTime() > Date.now());
  await app.close();
});

test("WS with invalid token gets error and close 1008", async () => {
  const h = await harness();
  try {
    const ws = await h.openSocket("bad.token.sig");
    const msg = await h.nextMessage(ws);
    assert.equal(msg.type, "error");
    assert.equal(msg.code, "UNAUTHORIZED");
    const { code } = await h.closedOnce(ws);
    assert.equal(code, 1008);
  } finally {
    await h.cleanup();
  }
});

test("WS FAST mode: chunk emits transcript.partial then transcript.final", async () => {
  await withSocket({}, async (h, ws) => {
    ws.send(JSON.stringify({ type: "session.start", mode: "FAST", languageHints: ["fr"] }));
    const ready = await h.nextMessage(ws);
    assert.equal(ready.type, "session.ready");
    assert.ok(ready.sessionId);

    ws.send(Buffer.from("fake-webm-audio"));
    const partial = await h.nextMessage(ws);
    assert.equal(partial.type, "transcript.partial");
    assert.equal(partial.text, "bonjour le monde");

    const final = await h.nextMessage(ws);
    assert.equal(final.type, "transcript.final");
    assert.equal(final.text, "bonjour le monde");
    assert.equal(final.confidence, 0.9);
    assert.equal(h.refineCalls(), 0);
    assert.equal(h.sttCalls.length, 1);
    assert.ok(h.sttCalls[0].endsWith(".webm"));
  });
});

test("WS BALANCED mode: refine produces final text, refine failure falls back to raw", async () => {
  await withSocket(
    {
      sttResult: {
        text: "bonjour le monde",
        confidence: 0.4,
        segments: [{ startMs: 0, endMs: 500, text: "bonjour le monde" }],
      },
      refineResult: { text: "Bonjour le monde !", segments: [{ startMs: 0, endMs: 500, text: "Bonjour le monde !" }] },
    },
    async (h, ws) => {
      ws.send(JSON.stringify({ type: "session.start", mode: "BALANCED" }));
      await h.nextMessage(ws); // session.ready
      ws.send(Buffer.from("fake-webm-audio"));
      await h.nextMessage(ws); // partial (STT, immediate)
      const final = await h.nextMessage(ws);
      assert.equal(final.type, "transcript.final");
      assert.equal(final.text, "bonjour le monde"); // raw STT first (low latency)
      const refined = await h.nextMessage(ws);
      assert.equal(refined.type, "transcript.refined");
      assert.equal(refined.text, "Bonjour le monde !");
      assert.equal(h.refineCalls(), 1);
    },
  );

  await withSocket(
    {
      sttResult: {
        text: "bonjour le monde",
        confidence: 0.4,
        segments: [{ startMs: 0, endMs: 500, text: "bonjour le monde" }],
      },
      refineResult: { error: new Error("claude down") },
    },
    async (h, ws) => {
      ws.send(JSON.stringify({ type: "session.start", mode: "BALANCED" }));
      await h.nextMessage(ws);
      ws.send(Buffer.from("fake-webm-audio"));
      await h.nextMessage(ws); // partial
      const final = await h.nextMessage(ws);
      assert.equal(final.type, "transcript.final");
      assert.equal(final.text, "bonjour le monde"); // raw kept; no refined event on failure
    },
  );
});

test("WS binary chunk before session.start gets error", async () => {
  await withSocket({}, async (_h, ws) => {
    ws.send(Buffer.from("early-audio"));
    const msg = await h_nextMessage(ws);
    assert.equal(msg.type, "error");
    assert.equal(msg.code, "SESSION_NOT_STARTED");
  });
});

// helper to avoid re-opening harness in the test above
async function h_nextMessage(ws: WebSocket): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

test("WS session.end closes cleanly with 1000", async () => {
  await withSocket({}, async (h, ws) => {
    ws.send(JSON.stringify({ type: "session.start", mode: "FAST" }));
    await h.nextMessage(ws);
    ws.send(JSON.stringify({ type: "session.end" }));
    const { code } = await h.closedOnce(ws);
    assert.equal(code, 1000);
  });
});
