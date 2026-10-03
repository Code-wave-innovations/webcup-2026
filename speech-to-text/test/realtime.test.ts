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

test("realtime config defaults favor turbo and skip speech gate", async () => {
  ensureTestEnv();
  // Isolate defaults: wipe only the vars under test, keep required keys from ensureTestEnv
  const prevModel = process.env.OPENROUTER_REALTIME_STT_MODEL;
  const prevGate = process.env.REALTIME_SKIP_SPEECH_GATE;
  delete process.env.OPENROUTER_REALTIME_STT_MODEL;
  delete process.env.REALTIME_SKIP_SPEECH_GATE;
  try {
    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();
    assert.equal(config.OPENROUTER_REALTIME_STT_MODEL, "openai/whisper-large-v3-turbo");
    assert.equal(config.REALTIME_SKIP_SPEECH_GATE, true);
  } finally {
    if (prevModel !== undefined) process.env.OPENROUTER_REALTIME_STT_MODEL = prevModel;
    else delete process.env.OPENROUTER_REALTIME_STT_MODEL;
    if (prevGate !== undefined) process.env.REALTIME_SKIP_SPEECH_GATE = prevGate;
    else delete process.env.REALTIME_SKIP_SPEECH_GATE;
  }
});

interface FakeSttResult {
  text: string;
  confidence?: number;
  segments: { startMs: number; endMs: number; text: string }[];
}

async function harness(opts: {
  sttResult?: FakeSttResult;
  refineResult?: { text: string; segments: FakeSttResult["segments"] } | { error: Error };
  /** If set, refine waits on this promise before resolving (for overlap tests). */
  refineGate?: { promise: Promise<void> };
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
    if (opts.refineGate) await opts.refineGate.promise;
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
    bufferMessages(ws);
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve(ws));
      ws.once("error", reject);
    });
  }

  function nextMessage(ws: WebSocket): Promise<Record<string, any>> {
    return h_nextMessage(ws);
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

test("POST /v1/realtime/tokens without Authorization mints ephemeral token (public)", async () => {
  ensureTestEnv();
  const { buildApp } = await import("../src/app.js");
  const { loadConfig } = await import("../src/config.js");
  const app = await buildApp(loadConfig());
  const res = await app.inject({ method: "POST", url: "/v1/realtime/tokens" });
  assert.equal(res.statusCode, 201);
  const body = res.json() as { token: string; expiresAt: string; wsUrl: string };
  assert.equal(body.token.split(".").length, 3);
  assert.equal(body.wsUrl, "/v1/transcriptions/realtime");
  assert.ok(new Date(body.expiresAt).getTime() > Date.now());
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

test("WS BALANCED: second chunk STT starts while refine still in flight", async () => {
  let releaseRefine!: () => void;
  const refineGate = {
    promise: new Promise<void>((resolve) => {
      releaseRefine = resolve;
    }),
  };

  await withSocket(
    {
      sttResult: {
        text: "premiere phrase",
        confidence: 0.4,
        segments: [{ startMs: 0, endMs: 400, text: "premiere phrase" }],
      },
      refineResult: {
        text: "Première phrase",
        segments: [{ startMs: 0, endMs: 400, text: "Première phrase" }],
      },
      refineGate,
    },
    async (h, ws) => {
      ws.send(JSON.stringify({ type: "session.start", mode: "BALANCED" }));
      await h.nextMessage(ws);

      ws.send(Buffer.from("chunk-one"));
      assert.equal((await h.nextMessage(ws)).type, "transcript.partial");
      assert.equal((await h.nextMessage(ws)).type, "transcript.final");
      assert.equal(h.refineCalls(), 1);
      assert.equal(h.sttCalls.length, 1);

      // Must not block: second chunk STT while refine held
      ws.send(Buffer.from("chunk-two"));
      const partial2 = await h.nextMessage(ws);
      assert.equal(partial2.type, "transcript.partial");
      assert.equal(h.sttCalls.length, 2);

      releaseRefine();
      let msg = await h.nextMessage(ws);
      while (msg.type !== "transcript.refined") {
        msg = await h.nextMessage(ws);
      }
      assert.equal(msg.type, "transcript.refined");
    },
  );
});

test("RealtimeSession BALANCED: handleChunk returns before refine resolves; STT provider reused", async () => {
  ensureTestEnv();
  const { RealtimeSession } = await import("../src/modules/realtime/session.js");

  let releaseRefine!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseRefine = resolve;
  });
  let sttCalls = 0;
  const events: Record<string, any>[] = [];
  const session = new RealtimeSession({
    sttProvider: {
      name: "fake-stt",
      transcribe: async () => {
        sttCalls++;
        return {
          text: "premiere phrase",
          confidence: 0.4,
          segments: [{ startMs: 0, endMs: 400, text: "premiere phrase" }],
          latencyMs: 1,
        };
      },
    } as never,
    refine: (async () => {
      await gate;
      return { text: "Première phrase", segments: [] };
    }) as never,
    writeFile: (async () => undefined) as never,
    removeFile: async () => undefined,
    makeWorkDir: async () => "/tmp/stt-rt-test-nonexistent",
  });
  await session.start({ mode: "BALANCED" });

  // If handleChunk awaited refine, this would hang until the gate opens (it never does before the race).
  const outcome = await Promise.race([
    session.handleChunk(Buffer.from("a"), (e) => events.push(e)).then(() => "returned"),
    new Promise<string>((r) => setTimeout(() => r("blocked"), 500)),
  ]);
  assert.equal(outcome, "returned");
  assert.deepEqual(events.map((e) => e.type), ["transcript.partial", "transcript.final"]);

  releaseRefine();
  await session.end(); // drains pending refines
  assert.deepEqual(events.map((e) => e.type), ["transcript.partial", "transcript.final"]);
  assert.equal(sttCalls, 1);
});

function makeSession(
  RealtimeSession: typeof import("../src/modules/realtime/session.js").RealtimeSession,
  refine: () => Promise<unknown>,
) {
  return new RealtimeSession({
    sttProvider: {
      name: "fake-stt",
      transcribe: async () => ({
        text: "premiere phrase",
        confidence: 0.4,
        segments: [{ startMs: 0, endMs: 400, text: "premiere phrase" }],
        latencyMs: 1,
      }),
    } as never,
    refine: refine as never,
    writeFile: (async () => undefined) as never,
    removeFile: async () => undefined,
    makeWorkDir: async () => "/tmp/stt-rt-test-nonexistent",
  });
}

test("RealtimeSession: synchronously throwing refine causes no unhandled rejection", async () => {
  ensureTestEnv();
  const { RealtimeSession } = await import("../src/modules/realtime/session.js");
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);
  try {
    const session = makeSession(RealtimeSession, () => {
      throw new Error("refiner factory/sync failure");
    });
    await session.start({ mode: "BALANCED" });
    await session.handleChunk(Buffer.from("a"), () => undefined);
    await new Promise((r) => setTimeout(r, 50));
    await session.end();
    await new Promise((r) => setImmediate(r));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("RealtimeSession: emit errors on refined event do not open the refine circuit", async () => {
  ensureTestEnv();
  const { RealtimeSession } = await import("../src/modules/realtime/session.js");
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);
  let refineCalls = 0;
  try {
    const session = makeSession(RealtimeSession, async () => {
      refineCalls++;
      return { text: "Première phrase", segments: [] };
    });
    await session.start({ mode: "BALANCED" });
    const throwingEmit = (e: { type: string }) => {
      if (e.type === "transcript.refined") throw new Error("socket closed");
    };
    for (let i = 0; i < 5; i++) {
      await session.handleChunk(Buffer.from("a"), throwingEmit as never);
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(refineCalls, 5); // circuit (opens at 3 failures) must stay closed
    await session.end();
    await new Promise((r) => setImmediate(r));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("WS binary chunk before session.start gets error", async () => {
  await withSocket({}, async (_h, ws) => {
    ws.send(Buffer.from("early-audio"));
    const msg = await h_nextMessage(ws);
    assert.equal(msg.type, "error");
    assert.equal(msg.code, "SESSION_NOT_STARTED");
  });
});

// Queue-based message reader: events emitted back-to-back (partial, final, refined)
// must not be dropped between successive `await nextMessage()` calls.
const messageBuffers = new WeakMap<
  WebSocket,
  { queue: Record<string, any>[]; waiters: ((m: Record<string, any>) => void)[] }
>();

function bufferMessages(ws: WebSocket): void {
  const buf = { queue: [] as Record<string, any>[], waiters: [] as ((m: Record<string, any>) => void)[] };
  messageBuffers.set(ws, buf);
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    const waiter = buf.waiters.shift();
    if (waiter) waiter(msg);
    else buf.queue.push(msg);
  });
}

function h_nextMessage(ws: WebSocket): Promise<Record<string, any>> {
  const buf = messageBuffers.get(ws);
  assert(buf, "socket not opened through harness.openSocket");
  const queued = buf.queue.shift();
  if (queued) return Promise.resolve(queued);
  return new Promise((resolve) => buf.waiters.push(resolve));
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
