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

- **27 passed**, **2 skipped** (FFmpeg preprocess) when ffprobe is unavailable — last run on `feat/stt-orchestrator`.
