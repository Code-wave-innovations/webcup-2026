# Speech Intelligence Orchestrator — Design Spec

**Status:** Approved design  
**Date:** 2026-10-03  
**Service path:** `speech-to-text/` (dedicated service, not part of `backend/`)  
**Product name:** Speech Intelligence Orchestrator

---

## 1. Objective

Build a **performant, multilingual, intelligent Speech-to-Text (STT) engine** that handles:

- French, Malagasy, English
- Code-switching (multiple languages in one utterance)
- Noisy audio
- Multi-speaker conversations (v3)
- Domain vocabulary (Fanampiana, Dolibarr, DevOps terms, etc.)

This is **not** a thin wrapper around a single STT API. It is an orchestrator that routes, scores, falls back, fuses, and refines transcripts.

### Non-goals (this service)

- Using Claude (or any LLM) as the primary STT engine
- Embedding STT logic inside the existing Express `backend/`
- Exposing provider API keys to any frontend

---

## 2. Separation of responsibilities

| Role | Technology |
|------|------------|
| Speech recognition | GPT Transcribe / OpenRouter STT |
| Orchestration | Fastify backend + RabbitMQ workers |
| Intelligent correction | Claude (Anthropic) |
| Fallback / comparison | OpenRouter (Whisper or equivalents) |
| Cache | Redis |
| Persistence | PostgreSQL + Prisma |

**Hard rule:** Claude refines text only. It must never receive raw audio for transcription.

---

## 3. Architecture

### 3.1 High-level flow (target)

```
Audio
  → Preprocessing (FFmpeg)
  → VAD (Voice Activity Detection)
  → Smart Chunking
  → Language Detection
  → STT Router → Primary STT (gpt-transcribe)
  → Confidence Score
  → Fallback STT (if needed)
  → Transcript Fusion
  → Claude Refiner
  → Speaker Diarization
  → Timestamp Engine
  → Final Result
```

### 3.2 MVP simplified flow (v1)

```
Audio
  → Preprocessing (FFmpeg → PCM 16 kHz mono)
  → STT (gpt-transcribe)
  → Claude Refiner
  → Timestamps
  → Persist + REST response
```

### 3.3 Component diagram

```
Client (Web / backend) --REST multipart / WebSocket--> Fastify API
                              |
              +---------------+---------------+
              |               |               |
          RabbitMQ         Redis         PostgreSQL
              |
           Worker(s)
              |
     +--------+--------+
     |        |        |
  OpenAI   OpenRouter  Claude
   STT       STT      Refiner
```

### 3.4 Monorepo relationship

- Lives at repo root: `speech-to-text/`
- Independent npm package and Docker Compose stack
- Consumers (`frontend/`, `backend/`) call `STT_BASE_URL` over HTTP/WS with a service API key
- No shared runtime with Express; no Prisma MySQL coupling

---

## 4. Operating modes

| Mode | Pipeline | Typical use |
|------|----------|-------------|
| `FAST` | Preprocess → Primary STT → (optional light refine off) | Low cost, low latency |
| `BALANCED` | Preprocess → Primary STT → Claude refine | Default production |
| `ACCURATE` | Full pipeline: VAD, multi-STT, fusion, advanced refine, diarization | High-stakes / noisy / domain |

Default mode: `BALANCED`.

---

## 5. Modules

### 5.1 Audio Engine

- Convert arbitrary input (mp3, wav, webm, m4a, ogg) via FFmpeg
- Normalize volume
- Optional light denoise
- Canonical format: **PCM 16-bit, 16 kHz, mono**
- Reject or truncate files above configured max duration / size

### 5.2 VAD (v2+)

- Detect speech segments
- Drop silence to cut provider cost
- Emit `speech.start` / `speech.stop` for realtime

### 5.3 Smart Chunker (v2+)

- Split on natural pauses and max duration
- Realtime chunks: 5–30 s
- Batch chunks: 30–120 s
- Overlap: 1–3 s to avoid boundary word loss

### 5.4 Language Detection

- File-level and segment-level hints
- Accept client `languageHints: ("fr" \| "en" \| "mg")[]`
- Preserve code-switching in output (do not force a single language)

### 5.5 STT Router (v3; stub in v2)

Chooses provider using:

- Detected / hinted language
- Audio quality proxy
- Latency budget
- Cost budget
- Mode (`FAST` / `BALANCED` / `ACCURATE`)

### 5.6 STT Providers

| Role | Provider |
|------|----------|
| Primary | `gpt-transcribe` (OpenAI) |
| Realtime | `gpt-live-transcribe` (or OpenAI realtime transcription API) |
| Fallback | OpenRouter (Whisper or other STT models) |

Each provider adapter implements:

```ts
interface SttProvider {
  readonly name: string;
  transcribe(input: SttInput): Promise<SttResult>;
}

interface SttInput {
  audioPath: string;
  languageHints?: string[];
  promptContext?: string;
  timestamps?: boolean;
}

interface SttResult {
  text: string;
  language?: string;
  confidence?: number;
  segments: TranscriptSegment[];
  raw?: unknown;
  latencyMs: number;
  costUsdEstimate?: number;
}

interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  speakerId?: string;
  language?: string;
}
```

### 5.7 Confidence Engine (v2+)

Score in `[0, 1]` from:

- Provider-reported confidence (when available)
- Audio quality heuristics (SNR / clipping / silence ratio)
- Agreement across multi-STT (v3)

Thresholds (configurable):

- `confidence < 0.55` → trigger fallback (mode ≠ `FAST`)
- `confidence < 0.40` → trigger multi-STT (mode `ACCURATE`)

### 5.8 Multi-STT Mode (v3)

- Run 2+ providers in parallel when confidence is low or mode is `ACCURATE`
- Feed results into Fusion Engine

### 5.9 Transcript Fusion Engine (v3)

- Align segments by timestamp / edit distance
- Prefer consensus tokens
- Prefer dictionary hits for proper nouns / domain terms
- Resolve phonetic near-misses using context

### 5.10 Context Engine

Input fields:

- `context.domain` (e.g. `"erp"`, `"devops"`)
- `context.keywords: string[]`
- Optional dictionary scope ids

Passed as STT prompt/context and to Claude refiner.

### 5.11 Dictionary System (v3)

Levels (most specific wins):

1. `global`
2. `organization`
3. `project`
4. `user`

Example entries: Fanampiana, Dolibarr, RabbitMQ.

CRUD via REST under `/v1/dictionaries` (v3).

### 5.12 Transcript Refiner (Claude)

**Rules (must be in system prompt):**

1. Do not translate
2. Do not invent content that is not implied by the transcript
3. Fix obvious ASR errors, punctuation, casing
4. Preserve original languages and code-switching
5. Prefer dictionary spellings when phonetically plausible

Input: raw transcript + segments + context + dictionary terms.  
Output: refined text + optionally adjusted segments (same timestamps unless clearly wrong boundaries).

### 5.13 Speaker Diarization (v3)

- Assign `speakerId` per segment
- Optional client mapping `speakerId → displayName`

### 5.14 Timestamp Engine

- Always: segment-level timestamps
- Optional: word-level timestamps when provider supports them (`options.wordTimestamps`)

---

## 6. Realtime (v2+)

```
Microphone
  → WebSocket /v1/transcriptions/realtime
  → VAD
  → Realtime STT
  → transcript.partial
  → transcript.final (end of utterance)
  → Claude refine on final utterance (BALANCED / ACCURATE)
```

### Client → server events

| Event | Payload |
|-------|---------|
| `session.start` | `{ mode, languageHints?, context?, options? }` |
| `audio.chunk` | binary PCM or base64 chunk + `seq` |
| `session.end` | `{}` |

### Server → client events

| Event | Payload |
|-------|---------|
| `speech.start` | `{ ts }` |
| `speech.stop` | `{ ts }` |
| `transcript.partial` | `{ text, languages? }` |
| `transcript.final` | `{ text, languages, confidence, segments }` |
| `error` | `{ code, message }` |

---

## 7. HTTP API

Base path: `/v1`  
Auth: `Authorization: Bearer <STT_API_KEY>` (service-to-service)

### 7.1 Create transcription

`POST /v1/transcriptions`  
`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | yes | Audio file |
| `languageHints` | JSON string array | no | e.g. `["fr","mg"]` |
| `context` | JSON object | no | `{ domain?, keywords? }` |
| `mode` | string | no | `FAST` \| `BALANCED` \| `ACCURATE` (default `BALANCED`) |
| `options` | JSON object | no | See below |

`options`:

```ts
interface TranscriptionOptions {
  retainAudio?: boolean;      // default false
  wordTimestamps?: boolean;   // default false
  dictionaryIds?: string[];   // v3
  async?: boolean;            // force async job; auto if duration > threshold
}
```

**Response `202` (async) or `200` (sync short audio):**

```ts
interface TranscriptionResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  mode: "FAST" | "BALANCED" | "ACCURATE";
  text?: string;
  languages?: string[];
  confidence?: number;
  segments?: TranscriptSegment[];
  speakers?: { id: string; label?: string }[]; // v3
  error?: { code: string; message: string };
  createdAt: string;
  completedAt?: string;
}
```

### 7.2 Get transcription

`GET /v1/transcriptions/:id` → `TranscriptionResponse`

### 7.3 Health

`GET /health` → `{ status: "ok", version: string }` (no auth)

### 7.4 Dictionaries (v3)

- `GET /v1/dictionaries`
- `POST /v1/dictionaries`
- `PUT /v1/dictionaries/:id`
- `DELETE /v1/dictionaries/:id`

---

## 8. Data model (PostgreSQL)

### TranscriptionJob

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `status` | enum | queued / processing / completed / failed |
| `mode` | enum | FAST / BALANCED / ACCURATE |
| `language_hints` | jsonb | |
| `context` | jsonb | |
| `options` | jsonb | |
| `audio_path` | text nullable | null after delete if !retainAudio |
| `text` | text nullable | refined final text |
| `languages` | jsonb | detected languages |
| `confidence` | float nullable | |
| `speakers` | jsonb nullable | v3 |
| `error_code` | text nullable | |
| `error_message` | text nullable | |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz nullable | |

### TranscriptSegment

| Column | Type |
|--------|------|
| `id` | uuid |
| `job_id` | uuid FK |
| `start_ms` | int |
| `end_ms` | int |
| `text` | text |
| `confidence` | float nullable |
| `speaker_id` | text nullable |
| `language` | text nullable |
| `ord` | int |

### DictionaryEntry (v3)

| Column | Type |
|--------|------|
| `id` | uuid |
| `term` | text |
| `level` | enum global/organization/project/user |
| `scope_id` | text nullable |
| `locale_hints` | jsonb |
| `created_at` | timestamptz |

### ProviderCall

| Column | Type |
|--------|------|
| `id` | uuid |
| `job_id` | uuid FK |
| `provider` | text |
| `operation` | text |
| `latency_ms` | int |
| `cost_usd_estimate` | float nullable |
| `success` | boolean |
| `created_at` | timestamptz |

### AccessLog

| Column | Type |
|--------|------|
| `id` | uuid |
| `job_id` | uuid nullable |
| `api_key_hash` | text |
| `route` | text |
| `status_code` | int |
| `created_at` | timestamptz |

---

## 9. Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+, TypeScript |
| HTTP | Fastify |
| Realtime | `@fastify/websocket` |
| Queue | RabbitMQ |
| Cache | Redis |
| DB | PostgreSQL + Prisma |
| Audio | FFmpeg (system binary in container) |
| Providers | OpenAI, OpenRouter, Anthropic SDKs / fetch |

Local infra via `speech-to-text/docker-compose.yml`: Postgres, Redis, RabbitMQ, API (+ worker profile).

---

## 10. Configuration (environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Default `9100` |
| `DATABASE_URL` | yes | PostgreSQL |
| `REDIS_URL` | yes (v2+) | Redis |
| `RABBITMQ_URL` | yes (async/v2+) | AMQP URL |
| `STT_API_KEY` | yes | Bearer key for consumers |
| `OPENAI_API_KEY` | yes | Primary STT |
| `ANTHROPIC_API_KEY` | yes (BALANCED+) | Refiner |
| `OPENROUTER_API_KEY` | yes (v2+) | Fallback |
| `MAX_AUDIO_BYTES` | no | Default 25_000_000 |
| `MAX_AUDIO_DURATION_SEC` | no | Default 7200 |
| `ASYNC_DURATION_THRESHOLD_SEC` | no | Default 120 |
| `CONFIDENCE_FALLBACK_THRESHOLD` | no | Default 0.55 |
| `RETAIN_AUDIO_DEFAULT` | no | Default `false` |

Keys never ship to frontend env (`VITE_*`).

---

## 11. Security

- All provider keys server-side only
- Authenticate every `/v1/*` route with service API key
- Hash API keys at rest in access logs (SHA-256)
- Validate MIME / magic bytes for uploads
- Sandbox FFmpeg with timeouts and resource limits
- Rate limit per API key (Redis, v2+)

---

## 12. Privacy

- `retainAudio: false` (default): delete audio file after successful processing
- Encrypt disk volumes in production (ops concern; document in deploy runbook)
- Access logs for audit; no raw transcript in debug logs by default
- Optional retention TTL job for completed transcripts (configurable)

---

## 13. Observability

Metrics (export Prometheus-compatible or structured logs in v1):

| Metric | Description |
|--------|-------------|
| `stt_latency_ms` | End-to-end and per-provider |
| `stt_cost_usd` | Estimated cost per job |
| `stt_confidence` | Final confidence |
| `stt_fallback_total` | Fallback invocations |
| `stt_wer` | Word Error Rate on labeled eval set (offline) |

Structured log fields: `jobId`, `mode`, `provider`, `latencyMs`, `success`.

---

## 14. Benchmark process

Internal dataset buckets:

- Clean / noisy
- FR / EN / MG / mixed
- Single / multi speaker (v3)

Compare: primary vs fallback vs fused; track WER, latency, cost.  
Scripts live under `speech-to-text/scripts/benchmark/` (v3 deliverable).

---

## 15. Roadmap & acceptance criteria

### v1 — MVP

**Includes:** upload, FFmpeg preprocess, gpt-transcribe, Claude refine, segment timestamps, REST `POST`/`GET`, Prisma job store, API key auth, optional async for long files.

**Accept:**

1. Upload a French (or English) audio file → `200`/`202` then `completed` with non-empty `text` and `segments[]` with timestamps.
2. Refined text preserves language (no forced translation).
3. With `retainAudio: false`, audio file is removed after completion.
4. Unauthenticated request → `401`.

### v2

**Includes:** OpenRouter fallback, confidence engine, VAD + chunking, WebSocket realtime, modes `FAST`/`BALANCED`, basic metrics, Redis rate limit/cache.

**Accept:**

1. Long audio (> chunk size) is processed in chunks without missing edge words (overlap).
2. Low-confidence path invokes fallback and records `ProviderCall` for both.
3. Realtime session emits `transcript.partial` then `transcript.final`.

### v3

**Includes:** intelligent STT router, multi-STT fusion, diarization, dictionary levels, mode `ACCURATE`, WER benchmark scripts, richer observability.

**Accept:**

1. `ACCURATE` on noisy mixed-language sample improves over `FAST` on internal benchmark (documented delta).
2. Dictionary terms (e.g. Fanampiana, Dolibarr) appear correctly when spoken.
3. Multi-speaker file returns distinct `speakerId` values on segments.

---

## 16. Error model

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing/invalid API key |
| `INVALID_AUDIO` | 400 | Unsupported or corrupt audio |
| `AUDIO_TOO_LARGE` | 413 | Size/duration limit |
| `PROVIDER_ERROR` | 502 | Upstream STT/LLM failure after retries |
| `JOB_NOT_FOUND` | 404 | Unknown id |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

Retries: transient provider errors — up to 2 retries with exponential backoff before job `failed`.

---

## 17. Package layout (target)

```
speech-to-text/
  docs/
    SPEC.md
    PLAN.md
  README.md
  package.json
  tsconfig.json
  docker-compose.yml
  prisma/
    schema.prisma
  src/
    index.ts
    app.ts
    config.ts
    plugins/
      auth.ts
    routes/
      health.ts
      transcriptions.ts
      dictionaries.ts          # v3
      realtime.ts              # v2
    modules/
      audio/
      vad/                     # v2
      chunker/                 # v2
      language/
      stt/
        providers/
        router.ts
      confidence/              # v2
      fusion/                  # v3
      context/
      dictionary/              # v3
      refiner/
      diarization/             # v3
      timestamps/
      pipeline/
    workers/
      transcription.worker.ts
    lib/
      redis.ts
      rabbitmq.ts
      metrics.ts
  scripts/
    benchmark/                 # v3
  test/
```

---

## 18. Product positioning

Not “just STT” — a **Speech Intelligence Orchestrator**:

- Multi-model orchestration
- Multilingual + code-switching awareness
- Domain context and dictionaries
- Intelligent correction without translation drift
- Automatic fallback and measurable confidence
