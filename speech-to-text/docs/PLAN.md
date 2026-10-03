# Speech Intelligence Orchestrator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated Fastify Speech-to-Text orchestrator (FR/EN/MG) with GPT Transcribe, Claude refinement, and a phased roadmap to realtime, fallback, fusion, and diarization.

**Architecture:** Independent npm package under `speech-to-text/`. Fastify API accepts multipart uploads and (later) WebSocket audio; RabbitMQ workers run the pipeline; PostgreSQL stores jobs; Redis caches/rate-limits. Claude never receives audio—only text for refinement.

**Tech Stack:** Node.js 20+, TypeScript, Fastify, Prisma, PostgreSQL, Redis, RabbitMQ, FFmpeg, OpenAI, OpenRouter, Anthropic.

**Spec:** [SPEC.md](./SPEC.md)

## Global Constraints

- Service lives only under `speech-to-text/`; do not add STT logic to `backend/` or `frontend/`.
- Never use Claude (or any LLM) as the STT engine; Claude refines text only.
- Provider API keys stay server-side (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`); never `VITE_*`.
- Canonical audio after preprocess: PCM 16-bit, 16 kHz, mono.
- Auth on every `/v1/*` route: `Authorization: Bearer <STT_API_KEY>`.
- Default mode: `BALANCED`. Default `retainAudio`: `false`.
- Supported language hints: `fr`, `en`, `mg` (+ code-switching).
- API base path: `/v1`. Default listen port: `9100`.
- Refiner rules: do not translate; do not invent; fix ASR errors; preserve original languages.

---

## File map (target)

| Path | Responsibility |
|------|----------------|
| `speech-to-text/package.json` | Scripts and dependencies |
| `speech-to-text/tsconfig.json` | TypeScript config |
| `speech-to-text/docker-compose.yml` | Postgres, Redis, RabbitMQ, api, worker |
| `speech-to-text/.env.example` | Env template |
| `speech-to-text/prisma/schema.prisma` | Data model |
| `speech-to-text/src/config.ts` | Typed env loading |
| `speech-to-text/src/app.ts` | Fastify app factory |
| `speech-to-text/src/index.ts` | HTTP server entry |
| `speech-to-text/src/plugins/auth.ts` | Bearer API key |
| `speech-to-text/src/routes/health.ts` | `GET /health` |
| `speech-to-text/src/routes/transcriptions.ts` | REST transcriptions |
| `speech-to-text/src/routes/realtime.ts` | WebSocket (v2) |
| `speech-to-text/src/routes/dictionaries.ts` | Dictionary CRUD (v3) |
| `speech-to-text/src/modules/audio/*` | FFmpeg preprocess |
| `speech-to-text/src/modules/stt/*` | Providers + router |
| `speech-to-text/src/modules/refiner/*` | Claude refine |
| `speech-to-text/src/modules/pipeline/*` | Orchestration |
| `speech-to-text/src/workers/transcription.worker.ts` | Queue consumer |
| `speech-to-text/src/lib/{prisma,redis,rabbitmq,metrics}.ts` | Infra clients |
| `speech-to-text/test/*` | Unit / integration tests |

---

## Phase A — Scaffold

### Task 1: Package and TypeScript scaffold

**Files:**
- Create: `speech-to-text/package.json`
- Create: `speech-to-text/tsconfig.json`
- Create: `speech-to-text/.gitignore`
- Create: `speech-to-text/.env.example`

**Interfaces:**
- Consumes: none
- Produces: npm scripts `dev`, `build`, `start`, `worker`, `test`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "speech-intelligence-orchestrator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "worker": "tsx watch src/workers/transcription.worker.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "start:worker": "node dist/workers/transcription.worker.js",
    "test": "node --import tsx --test test/**/*.test.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/websocket": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "amqplib": "^0.10.5",
    "dotenv": "^16.4.0",
    "fastify": "^5.0.0",
    "ioredis": "^5.4.0",
    "openai": "^4.70.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.5",
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.env.example`** with every variable from SPEC §10 (placeholder values only).

- [ ] **Step 4: Create `.gitignore`** (`node_modules/`, `dist/`, `.env`, `uploads/`, `tmp/`).

- [ ] **Step 5: Install dependencies**

```bash
cd speech-to-text && npm install
```

Expected: lockfile created, no errors.

- [ ] **Step 6: Commit**

```bash
git add speech-to-text/package.json speech-to-text/package-lock.json speech-to-text/tsconfig.json speech-to-text/.env.example speech-to-text/.gitignore
git commit -m "chore(stt): scaffold package and TypeScript config"
```

---

### Task 2: Docker Compose infra

**Files:**
- Create: `speech-to-text/docker-compose.yml`
- Create: `speech-to-text/Dockerfile`

**Interfaces:**
- Consumes: none
- Produces: services `postgres` (:5432), `redis` (:6379), `rabbitmq` (:5672, management :15672)

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: stt
      POSTGRES_PASSWORD: stt
      POSTGRES_DB: stt
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports: ["5672:5672", "15672:15672"]
volumes:
  pgdata:
```

- [ ] **Step 2: Write `Dockerfile`** based on `node:20-bookworm-slim` with `ffmpeg` installed via apt.

- [ ] **Step 3: Start infra**

```bash
cd speech-to-text && docker compose up -d postgres redis rabbitmq
```

Expected: three healthy containers.

- [ ] **Step 4: Commit**

```bash
git add speech-to-text/docker-compose.yml speech-to-text/Dockerfile
git commit -m "chore(stt): add Docker Compose infra and FFmpeg Dockerfile"
```

---

### Task 3: Config loader and Prisma schema (v1 tables)

**Files:**
- Create: `speech-to-text/src/config.ts`
- Create: `speech-to-text/prisma/schema.prisma`
- Create: `speech-to-text/src/lib/prisma.ts`

**Interfaces:**
- Consumes: process env
- Produces:
  - `loadConfig(): Config`
  - Prisma models `TranscriptionJob`, `TranscriptSegment`, `ProviderCall`, `AccessLog`

- [ ] **Step 1: Implement `src/config.ts` with Zod**

```ts
import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  PORT: z.coerce.number().default(9100),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@localhost:5672"),
  STT_API_KEY: z.string().min(8),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().optional(),
  MAX_AUDIO_BYTES: z.coerce.number().default(25_000_000),
  MAX_AUDIO_DURATION_SEC: z.coerce.number().default(7200),
  ASYNC_DURATION_THRESHOLD_SEC: z.coerce.number().default(120),
  CONFIDENCE_FALLBACK_THRESHOLD: z.coerce.number().default(0.55),
  RETAIN_AUDIO_DEFAULT: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof schema>;
export function loadConfig(): Config {
  return schema.parse(process.env);
}
```

- [ ] **Step 2: Write Prisma schema** per SPEC §8 for v1 models (`TranscriptionJob`, `TranscriptSegment`, `ProviderCall`, `AccessLog`). Use `provider = "postgresql"`. Add `DictionaryEntry` later in Phase D.

- [ ] **Step 3: Export Prisma client**

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

- [ ] **Step 4: Migrate**

```bash
cd speech-to-text && cp .env.example .env
# set DATABASE_URL=postgresql://stt:stt@localhost:5432/stt and STT_API_KEY + provider keys
npx prisma migrate dev --name init
```

Expected: tables created.

- [ ] **Step 5: Commit**

```bash
git add speech-to-text/src/config.ts speech-to-text/src/lib/prisma.ts speech-to-text/prisma
git commit -m "feat(stt): add config loader and Prisma schema"
```

---

### Task 4: Fastify app, health, auth plugin

**Files:**
- Create: `speech-to-text/src/app.ts`
- Create: `speech-to-text/src/index.ts`
- Create: `speech-to-text/src/plugins/auth.ts`
- Create: `speech-to-text/src/routes/health.ts`
- Create: `speech-to-text/test/auth.test.ts`

**Interfaces:**
- Consumes: `loadConfig()`
- Produces: `buildApp(config: Config): Promise<FastifyInstance>`

- [ ] **Step 1: Write failing auth test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

test("GET /v1/transcriptions/:id without key returns 401", async () => {
  const app = await buildApp(loadConfig());
  const res = await app.inject({ method: "GET", url: "/v1/transcriptions/00000000-0000-0000-0000-000000000001" });
  assert.equal(res.statusCode, 401);
  await app.close();
});
```

- [ ] **Step 2: Implement auth plugin**

```ts
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";

export const authPlugin = (config: Config): FastifyPluginAsync => async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/health")) return;
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ") || header.slice(7) !== config.STT_API_KEY) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
    }
  });
};
```

- [ ] **Step 3: Implement `buildApp` + `GET /health` + listen in `index.ts`.**

- [ ] **Step 4: Run test**

```bash
cd speech-to-text && npm test
```

Expected: PASS (or adjust until stub route exists returning 401 before 404).

- [ ] **Step 5: Commit**

```bash
git add speech-to-text/src speech-to-text/test
git commit -m "feat(stt): Fastify app with health and API key auth"
```

---

## Phase B — MVP v1

### Task 5: Shared STT types

**Files:**
- Create: `speech-to-text/src/modules/stt/types.ts`

**Interfaces:**
- Produces: `SttProvider`, `SttInput`, `SttResult`, `TranscriptSegment` as in SPEC §5.6

- [ ] **Step 1: Add types file matching SPEC exactly (including optional fields).**

- [ ] **Step 2: Commit**

```bash
git add speech-to-text/src/modules/stt/types.ts
git commit -m "feat(stt): add shared STT TypeScript contracts"
```

---

### Task 6: Audio Engine (FFmpeg)

**Files:**
- Create: `speech-to-text/src/modules/audio/preprocess.ts`
- Create: `speech-to-text/test/audio.preprocess.test.ts`

**Interfaces:**
- Consumes: input file path, `Config`
- Produces:
  - `preprocessAudio(inputPath: string, workDir: string): Promise<{ pcmPath: string; durationSec: number }>`

- [ ] **Step 1: Write a test that runs FFmpeg on a tiny fixture WAV** (commit a short silence fixture under `test/fixtures/silence.wav`).

- [ ] **Step 2: Implement preprocess with `ffmpeg -y -i input -ac 1 -ar 16000 -f s16le output.pcm` and probe duration via `ffprobe`.

- [ ] **Step 3: Reject when `durationSec > MAX_AUDIO_DURATION_SEC` with error code `AUDIO_TOO_LARGE`.

- [ ] **Step 4: Run tests; commit**

```bash
git add speech-to-text/src/modules/audio speech-to-text/test
git commit -m "feat(stt): FFmpeg audio preprocess to PCM 16kHz mono"
```

---

### Task 7: OpenAI GPT Transcribe provider

**Files:**
- Create: `speech-to-text/src/modules/stt/providers/gpt-transcribe.ts`
- Create: `speech-to-text/test/gpt-transcribe.mock.test.ts`

**Interfaces:**
- Consumes: `SttInput`, `OPENAI_API_KEY`
- Produces: `createGptTranscribeProvider(apiKey: string): SttProvider`

- [ ] **Step 1: Implement provider calling OpenAI transcription API with timestamps; map to `SttResult`.**

- [ ] **Step 2: Unit-test mapping with a mocked OpenAI client (no network).**

- [ ] **Step 3: Commit**

```bash
git add speech-to-text/src/modules/stt/providers speech-to-text/test
git commit -m "feat(stt): add gpt-transcribe provider adapter"
```

---

### Task 8: Claude Transcript Refiner

**Files:**
- Create: `speech-to-text/src/modules/refiner/claude-refiner.ts`
- Create: `speech-to-text/test/refiner.test.ts`

**Interfaces:**
- Consumes: raw text, segments, context, dictionary terms
- Produces:
  - `refineTranscript(input: RefineInput): Promise<{ text: string; segments: TranscriptSegment[] }>`

```ts
export interface RefineInput {
  text: string;
  segments: TranscriptSegment[];
  languageHints?: string[];
  context?: { domain?: string; keywords?: string[] };
  dictionaryTerms?: string[];
}
```

- [ ] **Step 1: System prompt must include the five refiner rules from Global Constraints.**

- [ ] **Step 2: Mock Anthropic SDK in unit test; assert prompt contains "Do not translate".**

- [ ] **Step 3: Commit**

```bash
git add speech-to-text/src/modules/refiner speech-to-text/test
git commit -m "feat(stt): add Claude transcript refiner"
```

---

### Task 9: Pipeline orchestrator (v1 path)

**Files:**
- Create: `speech-to-text/src/modules/pipeline/run-transcription.ts`
- Create: `speech-to-text/src/modules/timestamps/normalize.ts`
- Create: `speech-to-text/src/lib/metrics.ts`

**Interfaces:**
- Consumes: preprocess, gpt provider, refiner, prisma
- Produces:
  - `runTranscriptionJob(jobId: string): Promise<void>`

Pipeline for v1:

1. Load job from DB → set `processing`
2. `preprocessAudio`
3. Primary STT
4. Record `ProviderCall`
5. If `mode !== FAST` → Claude refine
6. Persist text + segments
7. Delete audio if `!retainAudio`
8. Set `completed` (or `failed` on error)

- [ ] **Step 1: Implement `runTranscriptionJob` with try/catch updating `error_code` / `error_message`.**

- [ ] **Step 2: Log structured metrics via `metrics.ts` (`jobId`, `latencyMs`, `provider`).**

- [ ] **Step 3: Commit**

```bash
git add speech-to-text/src/modules/pipeline speech-to-text/src/modules/timestamps speech-to-text/src/lib/metrics.ts
git commit -m "feat(stt): v1 transcription pipeline orchestration"
```

---

### Task 10: RabbitMQ queue + worker

**Files:**
- Create: `speech-to-text/src/lib/rabbitmq.ts`
- Create: `speech-to-text/src/workers/transcription.worker.ts`

**Interfaces:**
- Consumes: `RABBITMQ_URL`, `runTranscriptionJob`
- Produces:
  - `publishTranscriptionJob(jobId: string): Promise<void>`
  - queue name: `stt.transcription.jobs`

- [ ] **Step 1: Implement connect/publish/consume with durable queue and ack after success; nack without requeue after final failure.**

- [ ] **Step 2: Worker entry loads config, connects, consumes forever.**

- [ ] **Step 3: Commit**

```bash
git add speech-to-text/src/lib/rabbitmq.ts speech-to-text/src/workers
git commit -m "feat(stt): RabbitMQ transcription worker"
```

---

### Task 11: REST transcription routes

**Files:**
- Create: `speech-to-text/src/routes/transcriptions.ts`
- Modify: `speech-to-text/src/app.ts`
- Create: `speech-to-text/test/transcriptions.route.test.ts`

**Interfaces:**
- Consumes: multipart, prisma, `publishTranscriptionJob`, `runTranscriptionJob`
- Produces:
  - `POST /v1/transcriptions`
  - `GET /v1/transcriptions/:id`

Behavior:

- Save upload under `uploads/` (or `tmp/`)
- Create `TranscriptionJob` with status `queued`
- If duration ≤ `ASYNC_DURATION_THRESHOLD_SEC` and `options.async !== true`: process inline (or await worker quickly); else publish to queue and return `202`
- Map DB row → `TranscriptionResponse` from SPEC §7.1

- [ ] **Step 1: Implement routes with Zod validation for `mode`, `languageHints`, `context`, `options`.**

- [ ] **Step 2: Integration test with mocked pipeline (inject stub) asserting 401 without key and 200 shape with key.**

- [ ] **Step 3: Manual smoke (optional with real keys):**

```bash
curl -s -X POST http://localhost:9100/v1/transcriptions \
  -H "Authorization: Bearer $STT_API_KEY" \
  -F audio=@test/fixtures/sample-fr.wav \
  -F mode=BALANCED
```

- [ ] **Step 4: Commit**

```bash
git add speech-to-text/src/routes/transcriptions.ts speech-to-text/src/app.ts speech-to-text/test
git commit -m "feat(stt): REST POST/GET /v1/transcriptions"
```

---

### Task 12: v1 acceptance checklist

**Files:**
- Modify: `speech-to-text/README.md` (ops smoke section)

- [ ] **Step 1: Verify SPEC §15 v1 acceptance criteria manually; document commands in README.**

- [ ] **Step 2: Tag milestone**

```bash
git commit --allow-empty -m "chore(stt): v1 MVP acceptance checkpoint"
```

---

## Phase C — v2

### Task 13: Redis client + rate limiting

**Files:**
- Create: `speech-to-text/src/lib/redis.ts`
- Modify: `speech-to-text/src/plugins/auth.ts` (or new `plugins/rate-limit.ts`)

**Interfaces:**
- Produces: `getRedis(): Redis`, `assertRateLimit(apiKeyHash: string): Promise<void>` (e.g. 60 req/min)

- [ ] **Step 1: Implement ioredis wrapper and fixed-window rate limit; return HTTP 429 with code `RATE_LIMITED` when exceeded.**

- [ ] **Step 2: Commit** `feat(stt): Redis rate limiting`

---

### Task 14: Confidence engine + OpenRouter fallback

**Files:**
- Create: `speech-to-text/src/modules/confidence/score.ts`
- Create: `speech-to-text/src/modules/stt/providers/openrouter.ts`
- Modify: `speech-to-text/src/modules/pipeline/run-transcription.ts`

**Interfaces:**
- Produces:
  - `scoreConfidence(input: { providerConfidence?: number; audioQuality?: number; agreement?: number }): number`
  - `createOpenRouterSttProvider(apiKey: string): SttProvider`

- [ ] **Step 1: If `mode !== FAST` and confidence `< CONFIDENCE_FALLBACK_THRESHOLD`, call OpenRouter and keep the higher-confidence (or fused-later) result; always write both `ProviderCall` rows.**

- [ ] **Step 2: Unit tests for threshold boundaries (0.54 triggers, 0.55 does not).**

- [ ] **Step 3: Commit** `feat(stt): confidence scoring and OpenRouter fallback`

---

### Task 15: VAD + Smart Chunker

**Files:**
- Create: `speech-to-text/src/modules/vad/detect.ts`
- Create: `speech-to-text/src/modules/chunker/smart-chunk.ts`

**Interfaces:**
- Produces:
  - `detectSpeechSegments(pcmPath: string): Promise<{ startMs: number; endMs: number }[]>`
  - `chunkSegments(segments, opts: { minSec: number; maxSec: number; overlapSec: number }): Chunk[]`

Defaults: batch `maxSec=120`, `overlapSec=2`; realtime `maxSec=30`, `overlapSec=1`.

- [ ] **Step 1: Implement energy-based VAD MVP (upgradeable later); unit-test silence fixture yields zero/near-zero segments.**

- [ ] **Step 2: Wire chunk loop into pipeline for long audio: STT per chunk → concatenate segments with time offsets.**

- [ ] **Step 3: Commit** `feat(stt): VAD and smart chunking`

---

### Task 16: Realtime WebSocket

**Files:**
- Create: `speech-to-text/src/routes/realtime.ts`
- Modify: `speech-to-text/src/app.ts`
- Create: `speech-to-text/src/modules/stt/providers/gpt-live-transcribe.ts`

**Interfaces:**
- Produces: WS endpoint `/v1/transcriptions/realtime` with events from SPEC §6

- [ ] **Step 1: Register `@fastify/websocket`; auth via query `?token=` or first message (document chosen approach in README: prefer `Authorization` header where clients allow it, else `token` query).**

- [ ] **Step 2: Handle `session.start`, `audio.chunk`, `session.end`; emit `speech.*` and `transcript.partial` / `transcript.final`.**

- [ ] **Step 3: On final utterance in `BALANCED`, run Claude refine before emitting `transcript.final`.**

- [ ] **Step 4: Commit** `feat(stt): realtime WebSocket transcription`

---

### Task 17: Modes FAST / BALANCED wiring

**Files:**
- Modify: `speech-to-text/src/modules/pipeline/run-transcription.ts`

- [ ] **Step 1: `FAST` skips Claude refine and skips fallback unless provider hard-fails.**

- [ ] **Step 2: `BALANCED` uses refine + confidence fallback.**

- [ ] **Step 3: Commit** `feat(stt): honor FAST and BALANCED modes`

---

### Task 18: v2 acceptance checklist

- [ ] **Step 1: Verify SPEC §15 v2 criteria (chunked long audio, fallback ProviderCalls, realtime partials).**

- [ ] **Step 2: Empty commit** `chore(stt): v2 acceptance checkpoint`

---

## Phase D — v3

### Task 19: Dictionary system

**Files:**
- Create: `speech-to-text/src/modules/dictionary/store.ts`
- Create: `speech-to-text/src/routes/dictionaries.ts`
- Modify: `speech-to-text/prisma/schema.prisma` (add `DictionaryEntry`)
- Modify: `speech-to-text/src/app.ts`

**Interfaces:**
- Produces: CRUD `/v1/dictionaries`; `resolveDictionaryTerms(scope): Promise<string[]>` (global < org < project < user merge, most specific wins)

- [ ] **Step 1: Migrate `DictionaryEntry` model.**

- [ ] **Step 2: Wire terms into STT prompt context and Claude refiner `dictionaryTerms`.**

- [ ] **Step 3: Commit** `feat(stt): multi-level dictionary system`

---

### Task 20: STT Router + Multi-STT + Fusion

**Files:**
- Create: `speech-to-text/src/modules/stt/router.ts`
- Create: `speech-to-text/src/modules/fusion/fuse.ts`
- Modify: `speech-to-text/src/modules/pipeline/run-transcription.ts`

**Interfaces:**
- Produces:
  - `selectProviders(ctx: RouterContext): SttProvider[]`
  - `fuseTranscripts(results: SttResult[], dictionaryTerms: string[]): SttResult`

- [ ] **Step 1: `ACCURATE` or `confidence < 0.40` → run ≥2 providers in parallel.**

- [ ] **Step 2: Fusion prefers consensus and dictionary spellings; unit-test Dolibarr-style correction.**

- [ ] **Step 3: Commit** `feat(stt): router, multi-STT, and fusion engine`

---

### Task 21: Speaker diarization

**Files:**
- Create: `speech-to-text/src/modules/diarization/diarize.ts`
- Modify: pipeline to attach `speakerId` on segments and `speakers` on job

**Interfaces:**
- Produces: `diarize(pcmPath: string, segments: TranscriptSegment[]): Promise<{ segments; speakers }>`

- [ ] **Step 1: Integrate a concrete diarization approach (provider-native speakers if available; otherwise a dedicated library/API behind this interface).**

- [ ] **Step 2: Persist speakers JSON on `TranscriptionJob`.**

- [ ] **Step 3: Commit** `feat(stt): speaker diarization`

---

### Task 22: Mode ACCURATE + observability + WER benchmark

**Files:**
- Create: `speech-to-text/scripts/benchmark/run-wer.ts`
- Create: `speech-to-text/scripts/benchmark/README.md`
- Modify: `speech-to-text/src/lib/metrics.ts`

**Interfaces:**
- Produces: CLI that reads `scripts/benchmark/dataset/` (`audio` + `reference.txt`) and prints WER / latency / cost table

- [ ] **Step 1: Implement simple WER (word-level edit distance).**

- [ ] **Step 2: Export Prometheus-style text metrics endpoint `GET /metrics` (auth optional/internal).**

- [ ] **Step 3: Commit** `feat(stt): ACCURATE mode metrics and WER benchmark script`

---

### Task 23: v3 acceptance checklist

- [ ] **Step 1: Verify SPEC §15 v3 criteria (ACCURATE delta, dictionary terms, multi-speaker ids).**

- [ ] **Step 2: Empty commit** `chore(stt): v3 acceptance checkpoint`

---

## Out of scope (separate plans)

- Wiring `frontend/` or Express `backend/` as first-class clients (env `STT_BASE_URL` + API key)
- Production Kubernetes / TLS / secret manager setup
- Training custom ASR models

---

## Spec coverage matrix

| Spec area | Tasks |
|-----------|-------|
| Dedicated Fastify service | 1–4 |
| Audio Engine | 6 |
| GPT Transcribe | 7 |
| Claude Refiner | 8 |
| REST API + jobs | 9–12 |
| Confidence + OpenRouter | 14 |
| VAD + Chunking | 15 |
| Realtime WS | 16 |
| Modes FAST/BALANCED/ACCURATE | 17, 22 |
| Dictionary | 19 |
| Router / Multi-STT / Fusion | 20 |
| Diarization | 21 |
| Observability / WER | 22 |
| Security / privacy | 3–4, 9, 13 |

---

## Execution handoff

Plan complete and saved to `speech-to-text/docs/PLAN.md`.

Two execution options for implementation (code):

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in-session with checkpoints  

Which approach?
