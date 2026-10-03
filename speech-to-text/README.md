# Speech Intelligence Orchestrator

Dedicated **Speech-to-Text** service for the Webcup monorepo: multilingual orchestration (FR / EN / MG), domain-aware correction, and multi-provider fallback — not a thin wrapper around a single ASR API.

This package is **independent** from `backend/` (Express + MySQL) and `frontend/`. Consumers call it over HTTP (and later WebSocket) with a server-side API key.

## Docs

| Document | Purpose |
|----------|---------|
| [docs/SPEC.md](./docs/SPEC.md) | Design spec: architecture, modules, API contracts, data model, security, roadmap v1→v3 |
| [docs/PLAN.md](./docs/PLAN.md) | Implementation plan: checkbox tasks, file map, interfaces, acceptance checkpoints |

Read the **SPEC** before changing behavior. Execute the **PLAN** task-by-task when building the service.

## Product principles

- **STT engines:** GPT Transcribe (primary), OpenRouter (fallback) — never Claude as ASR
- **Refinement:** Claude corrects ASR text only (no translation, no invention)
- **Modes:** `FAST` · `BALANCED` (default) · `ACCURATE`
- **Privacy:** provider keys stay on this service; audio deleted by default after processing

## Target stack

Fastify · TypeScript · PostgreSQL · Prisma · Redis · RabbitMQ · FFmpeg · OpenAI · Anthropic

Default API port: `9100` · Base path: `/v1`

## Integration (how to call this service)

**Rule:** never put `STT_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` in the frontend (`VITE_*`). Only this service and a **server-side** consumer (Express `backend/`, BFF, job) may hold `STT_API_KEY`.

```
Browser / React
    │  (audio only — no STT secret)
    ▼
backend/ (Express)  ──Bearer STT_API_KEY──►  speech-to-text :9100
```

### 1. Run the STT service

```bash
cd speech-to-text
docker compose up -d postgres redis rabbitmq
cp .env.example .env   # set STT_API_KEY + provider keys + DATABASE_URL
npm install && npx prisma migrate dev
export PATH="$PWD/bin:$PATH"   # optional: local ffmpeg x265 workaround
npm run dev                    # http://localhost:9100
npm run worker                 # needed for 202 / long / options.async
```

### 2. Env on the consumer (`backend/`)

```bash
# backend/.env (example)
STT_BASE_URL=http://localhost:9100
STT_API_KEY=same-value-as-speech-to-text-STT_API_KEY
```

Do **not** add these to `frontend/.env`.

### 3. API contract (v1)

| Method | Path | Auth | Body |
|--------|------|------|------|
| `GET` | `/health` | none | — |
| `POST` | `/v1/transcriptions` | `Authorization: Bearer <STT_API_KEY>` | `multipart/form-data` |
| `GET` | `/v1/transcriptions/:id` | Bearer | — |

**POST fields**

| Field | Required | Notes |
|-------|----------|--------|
| `audio` | yes | file (wav, mp3, webm, m4a, …) |
| `mode` | no | `FAST` \| `BALANCED` (default) \| `ACCURATE` |
| `languageHints` | no | JSON string, e.g. `["fr","mg"]` |
| `context` | no | JSON string, e.g. `{"domain":"erp","keywords":["Fanampiana"]}` |
| `options` | no | JSON string: `retainAudio`, `wordTimestamps`, `async` |

**Response** (`200` sync short audio, or `202` queued):

```json
{
  "id": "uuid",
  "status": "queued|processing|completed|failed",
  "mode": "BALANCED",
  "text": "…",
  "languages": ["french"],
  "confidence": 0.61,
  "segments": [{ "startMs": 0, "endMs": 5000, "text": "…", "confidence": 0.61 }],
  "createdAt": "…",
  "completedAt": "…"
}
```

If `status` is `queued` / `processing`, poll `GET /v1/transcriptions/:id` until `completed` or `failed`.

### 4. From Express (`backend/`) — recommended

```ts
import FormData from "form-data";
import fs from "node:fs";
import axios from "axios";

const stt = axios.create({
  baseURL: process.env.STT_BASE_URL ?? "http://localhost:9100",
  headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
  maxBodyLength: Infinity,
});

export async function transcribeFile(filePath: string) {
  const form = new FormData();
  form.append("audio", fs.createReadStream(filePath));
  form.append("mode", "BALANCED");
  form.append("languageHints", JSON.stringify(["fr", "en", "mg"]));
  form.append(
    "context",
    JSON.stringify({ domain: "erp", keywords: ["Fanampiana", "Dolibarr"] }),
  );

  const { data, status } = await stt.post("/v1/transcriptions", form, {
    headers: form.getHeaders(),
  });

  if (status === 202 || data.status === "queued" || data.status === "processing") {
    return waitForJob(data.id);
  }
  return data;
}

async function waitForJob(id: string, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await stt.get(`/v1/transcriptions/${id}`);
    if (data.status === "completed" || data.status === "failed") return data;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("STT job timeout");
}
```

Mount a thin proxy on Express if the UI must upload through your API, e.g. `POST /api/stt` → forward multipart to `STT_BASE_URL/v1/transcriptions` with the server key. The browser never sees `STT_API_KEY`.

### 5. From the frontend (`frontend/`) — via your backend only

```ts
// Browser: upload to YOUR backend, not to :9100 with a secret
const form = new FormData();
form.append("audio", audioBlob, "recording.webm");
form.append("mode", "BALANCED");

const { data } = await fileHttp.post("/stt", form); // your Express route
// data.text, data.segments, data.status
```

Do not call `http://localhost:9100` from Vite with the STT bearer key.

### 6. curl (manual)

```bash
set -a && source .env && set +a

curl -s -X POST http://localhost:9100/v1/transcriptions \
  -H "Authorization: Bearer $STT_API_KEY" \
  -F "audio=@./test/fixtures/sample-fr.wav" \
  -F "mode=BALANCED" \
  -F 'languageHints=["fr"]' \
  -F 'context={"keywords":["Fanampiana"]}'
```

### 7. Errors to handle

| HTTP / status | Meaning |
|---------------|---------|
| `401` | Missing/invalid `STT_API_KEY` |
| `400` | Validation (mode, JSON fields, missing `audio`) |
| `413` | File too large / duration over limit (default 12 min) |
| `502` | Queue unavailable (async publish failed) |
| `status: "failed"` | Pipeline error — read `error.code` / `error.message` (sanitized) |

Full contracts: [docs/SPEC.md](./docs/SPEC.md) §7.

## Status (v1 MVP)

**Branch:** `feat/stt-orchestrator` — MVP application code is in place (REST API, worker, pipeline, Prisma job store, API key auth).

**Not fully verified in this environment:**

- **FFmpeg / ffprobe** must be installed on the host for audio preprocess. On some dev machines FFmpeg is missing or broken; automated preprocess tests are **skipped** when ffprobe is unavailable (`test/preprocess.test.ts`).
- **Live end-to-end smoke** (real French/English audio → OpenAI STT → Claude refine) requires valid `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, running Postgres/RabbitMQ, worker process, and working FFmpeg. Route and pipeline behavior is covered by **mocked** integration tests.

## Local setup

```bash
cd speech-to-text
cp .env.example .env
# Align DATABASE_URL with docker-compose (user stt / password stt / db stt), e.g.:
# DATABASE_URL=postgresql://stt:stt@localhost:5432/stt
docker compose up -d postgres redis rabbitmq
npm install
npx prisma migrate dev
npm run dev          # API (port 9100)
npm run worker       # RabbitMQ transcription worker (required for async / long jobs)
```

Ensure **ffmpeg** and **ffprobe** are on your `PATH` before uploading audio.

`MAX_AUDIO_DURATION_SEC` defaults to 720 (12 min): 16 kHz mono PCM-as-WAV is ~32 KB/s, so 12 min stays under OpenAI's ~25 MB upload limit; raising it requires chunking.

### Realtime latency (env)

WebSocket realtime STT uses separate defaults from batch upload (`OPENROUTER_STT_MODEL` unchanged):

| Variable | Default | Notes |
|----------|---------|--------|
| `OPENROUTER_REALTIME_STT_MODEL` | `openai/whisper-large-v3-turbo` | Faster model for WebSocket realtime |
| `REALTIME_SKIP_SPEECH_GATE` | `true` | Skip FFmpeg silence gate (client VAD already filters) |

See `.env.example` for the full list.

## Ops smoke (manual)

Set `STT_API_KEY` in `.env` (same value as `Authorization: Bearer …` below).

```bash
# Public health (no auth)
curl -s http://localhost:9100/health | jq .

# Create transcription (short file may complete inline with 200; long/async → 202 queued)
curl -s -X POST http://localhost:9100/v1/transcriptions \
  -H "Authorization: Bearer $STT_API_KEY" \
  -F "audio=@./test/fixtures/sample.wav" \
  -F "mode=BALANCED" | jq .

# Poll job (replace JOB_ID)
curl -s http://localhost:9100/v1/transcriptions/JOB_ID \
  -H "Authorization: Bearer $STT_API_KEY" | jq .
```

For **202 queued** responses, the worker must be running and RabbitMQ reachable.

## v1 acceptance checklist (SPEC §15)

MVP scope: upload, FFmpeg preprocess, gpt-transcribe, Claude refine, segment timestamps, REST `POST`/`GET`, Prisma job store, API key auth, optional async for long files.

| # | Criterion | Automated tests | Manual / live prerequisites |
|---|-----------|-----------------|-----------------------------|
| 1 | Upload FR or EN audio → `200`/`202`, then `completed` with non-empty `text` and `segments[]` with timestamps | **Partial:** `POST` inline 200 with mocked STT/refine and segments (`test/transcriptions.route.test.ts`); async 202 + queue (`test/transcriptions.route.test.ts`); pipeline persist + segments (`test/pipeline.test.ts`); segment mapping (`test/gpt-transcribe.mock.test.ts`) | Real audio file, FFmpeg, API keys, API + worker + DB; confirm `status: completed` on `GET` |
| 2 | Refined text preserves language (no forced translation) | **Partial:** refiner prompt and mocked Claude path assert “Do not translate” (`test/refiner.test.ts`); pipeline uses refiner on `BALANCED` (`test/pipeline.test.ts`) | Listen/read output on live FR/EN samples; no cross-language drift |
| 3 | With `retainAudio: false`, audio file removed after completion | **Yes:** default pipeline deletes processed audio (`test/pipeline.test.ts` “BALANCED job … delete audio”); `retainAudio: true` keeps file (same file) | Optional: inspect storage path on disk after live job |
| 4 | Unauthenticated request → `401` | **Yes:** `POST` and `GET` without key (`test/transcriptions.route.test.ts`, `test/auth.test.ts`) | `curl` without `Authorization` header |

Run automated suite:

```bash
cd speech-to-text && npm test
```

## Tests

```bash
cd speech-to-text && export PATH="$PWD/bin:$PATH" && npm test
```

Expect **35 passed** when local ffmpeg works (use `bin/` wrappers if Homebrew x265 is broken).
