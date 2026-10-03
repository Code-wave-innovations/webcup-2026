# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

WebCup 2026 hackathon monorepo ("Terra Nova" brief: build the central digital platform for a new city, with feature requests published over the organizers' API during 24 hours). It contains four independent projects with no shared tooling at the root (the root `package-lock.json` is empty). Run commands from inside each directory.

| Dir | Stack | Port | Datastore |
|-----|-------|------|-----------|
| `backend/` | Express 5 + TypeScript + Prisma, CommonJS, ts-node | 9002 | MySQL 5.7 (docker, :3300) |
| `frontend/` | React 19 + Vite + TS + Tailwind v4 + react-router 7 | 5173 | — |
| `speech-to-text/` | Fastify 5 + TS (ESM, NodeNext) + Prisma, worker via RabbitMQ | 9100 | Postgres 16 :5432, Redis :6379, RabbitMQ :5672 (docker) |
| `face-recognitions/` | Python 3.10–3.11 Flask + InsightFace (SCRFD + ArcFace) | 9000 | `.npy` files under `data/` |

Only `speech-to-text/` has tests. Design docs live in `docs/superpowers/specs/` and `speech-to-text/docs/` (SPEC.md is the source of truth for STT behavior; PLAN.md is the task checklist).

## Backend (`cd backend`)

```bash
docker compose up -d          # MySQL 5.7 on localhost:3300, phpMyAdmin on localhost:88 (credentials in docker-compose.yml)
cp .env.examle .env           # note the misspelled filename; set DATABASE_URL, optionally PORT and ENV=development
npm run dev                   # nodemon + ts-node running index.ts
npm run build                 # tsc -> dist/
npm start                     # node dist/index.js
npx prisma migrate dev        # apply schema.prisma changes (also regenerates the client)
npx prisma generate           # regenerate @prisma/client only
npm run seed                  # idempotent demo data + accounts (prisma/seed.ts)
npm run typecheck             # tsc --noEmit; the only automated check
npm run generate:crud -- <table> <field>:<type>[:<modifier>] ...
```

`rootDir` is the backend root, so the build outputs `dist/index.js` plus `dist/src/**`. The committed `backend/index.js` is a stale compiled copy of `index.ts`, not the build output. Run `npx prisma generate` after a fresh install; otherwise the server crashes on startup when a model is imported. `JWT_SECRET` comes from `.env`; `src/services/services.ts` falls back to a hardcoded dev secret and logs a warning.

`prisma migrate dev` refuses to run in a non-interactive shell (such as Claude's). To create a migration there, write the SQL with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql`, hand-edit it when adding required columns to tables that have rows, then run `npx prisma migrate deploy && npx prisma generate`.

### Domain API (Terra Nova)

The platform answers feature requests published by the hackathon's Terra Nova API. Their codes (D01, F25…) are cited in comments next to the code that implements them, and `backend/README.md` maps every endpoint to its codes. The domain modules are hand-written, not generated, and follow different conventions from the generator:
- Shared building blocks: `src/lib/prisma.ts` (single PrismaClient; generated models still create their own), `lib/errors.ts` (`HttpError` helpers), `lib/validation.ts` (zod helpers: `zBool`/`zJson`/`zId` coerce multipart strings, pagination, `parseId`, `idOrSlugWhere`, `slugify`), `lib/upload.ts` (`saveUpload` with an extension whitelist), `lib/notify.ts`, `lib/translations.ts`.
- Controllers validate with zod `.parse()` and just `throw`. Express 5 forwards async errors to `middleware/error.ts`, which maps ZodError→400, `HttpError`, and Prisma P2002→409, P2025→404, P2003→400. Express 5's `req.query` is read-only, so parse it in the controller rather than in a middleware.
- Routes are RESTful: `PATCH /:id` and `DELETE /:id`, with the id in the URL. Lists return `{ data, meta }`.
- Auth: `middleware/auth.ts` provides `authenticate`, `optionalAuth`, `requireStaff` (AGENT+ADMIN) and `requireAdmin`, and sets `req.user` (type augmented in that file). The user row is reloaded on every request, so role changes and deactivation apply immediately. Never select `password_hash`; use `publicUserSelect` from `user.model.ts`.
- `CitizenRequest` is the single table behind contact messages, procedures and incident reports (`type`). Every status, assignment, priority or comment change must also write a `RequestEvent` (`citizenRequest.model.ts` `update` takes the events). `is_internal` events are hidden from citizens. Citizens see only their own requests, and a request belonging to someone else returns 404, not 403.
- Translations (F27) use the generic `ContentTranslation` table (entity, entity_id, locale, field) overlaid by `translate()`. To make a new model translatable, add it to `TRANSLATABLE_FIELDS` in `lib/translations.ts`. The locale comes from `?lang=`, then the user's `locale`, then `Accept-Language`, then `fr`.
- Login protection (F37) lives in `lib/loginGuard.ts` and is computed from the `LoginAttempt` table: an email locks after 5 failures in 15 min since its last success or staff unlock, an IP after 20. `lib/rateLimit.ts` is an in-memory, per-process limiter. Production runs on cPanel (Passenger behind Apache). There, `req.ip` can be undefined (Unix socket) or the proxy's, so `clientIp()` returns undefined when the IP is unknown and per-IP limits are skipped. `TRUST_PROXY=1` enables `X-Forwarded-For`; `GET /api/security/client-ip` shows what the app sees.
- Service availability (F38) is derived from `ServiceInterruption` rows by `lib/availability.ts`. Service responses expose `availability` (`withAvailability`) instead of the raw relation. `serviceListInclude()` is a function because its filter depends on the current time. Creating a request or booking on an unavailable service throws `409 SERVICE_UNAVAILABLE`.
- `index.ts` calls `startScheduler()` (`lib/scheduler.ts`), which sends appointment reminders every minute (F40). Passenger stops idle apps, so production also runs `dist/src/jobs/sendReminders.js` from a cPanel Cron Job. Reminders are claimed atomically, so several runs or processes never send one twice. Timetables (`TransitDeparture.time` is "HH:MM" text) and slot labels use the process time zone (`TZ`).
- Alert targeting (`audience` ALL / DISTRICTS / VULNERABLE plus optional districts) is defined once in `alert.model.ts` (`audienceUserWhere`, `concernsUser`). Notifications are fanned out with `notifyUsers(where, …)`.
- To add a feature: extend `schema.prisma`, add a migration, then add `model/`, `controller/` and `router/` files following an existing module (e.g. `district.*` for plain CRUD) and mount the router in `index.ts`.

### The CRUD generator

Most backend code is produced by `scripts/create-crud.ts`, which calls four generators in `scripts/bases/`. Example from the README:

```bash
npm run generate:crud -- user name:string last_name:string:@unique profile:string:file email:string:@unique couverture:string:file
```

For a table `foo`, the script:
1. **Appends** a `model Foo` block to `prisma/schema.prisma`, with auto `id` (autoincrement Int) and `created_at` columns. Types are capitalized and must be Prisma scalar types. Extra segments such as `@unique` are copied into the schema verbatim. The special `file` modifier is dropped from the schema, so the column is a plain String that stores the uploaded file name.
2. Writes `src/model/foo.model.ts`, a Prisma wrapper whose `getAll/getOne/create/update/delete` take **positional** arguments in field order, with file fields last.
3. Writes `src/controller/foo.controller.ts`. It reads fields from `req.body`. For each `file` field, it reads the upload from `req.files.<field>`, uses `req.body.<field>` as the file name prefix, and saves the file to `./public/` with `uploadFile` from `services.ts`.
4. Writes `src/router/foo.router.ts`: `GET /`, `GET /:id`, `POST /`, `PUT /`, `DELETE /`. Update and delete read `id` from the **request body**, not from the URL. Generated routes have no auth or validation. Add `authenticate`/`requireStaff` and zod parsing by hand before exposing anything sensitive.

The generator will not overwrite existing model, controller, or router files; it exits instead. However, it has already appended to `schema.prisma` before that check runs, so a failed run can leave a duplicate model block that you have to remove by hand. The generator does **not** mount the router or run a migration. After generating:
- Import the router in `backend/index.ts` and mount it under the `// All router here` comment, for example `app.use('/api/foo', fooRouter)`. The frontend expects routes under `/api`. Mount it before the `notFoundHandler`/`errorHandler` lines at the end of `index.ts`.
- Run `npx prisma migrate dev`.

If you edit a generated file by hand, keep the generator templates in `scripts/bases/*.generation.ts` in sync when the change should apply to future tables.

Static uploads are served at `/public`. `index.ts` resolves the folder to `./public` when `ENV=development` and to `../public` otherwise (relative to the compiled file's `__dirname`). `uploadFile` writes to `./public/` relative to the process working directory.

## Frontend (`cd frontend`)

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint (flat config in eslint.config.js)
npm run preview
```

`tsconfig.app.json` enables `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no enums, namespaces, or parameter properties).

Routes are declared in `src/App.tsx`: `/` (Home), `/face` (FaceUnlock), `/transcription` (RealtimeTranscription). Animations use `motion`. The brand palette is defined as CSS variables in `src/index.css` (`--navy: #0a2342`, `--wave: #4a90ff`); some components also use these hex values inline as Tailwind arbitrary values.

Service URLs come from `frontend/.env` (copy `.env.example`, typed in `src/vite-env.d.ts`, restart `npm run dev` after changes). Each service has its own client:
- `src/hooks/useHttps.ts` → Express backend (`VITE_BASE_URL`, `VITE_API_URL`, `VITE_IMG_URL`). Returns module-level axios instances that are stable across renders: `http` (JSON) and `fileHttp` (multipart, for generated endpoints that have `file` fields).
- `src/hooks/useFaceApi.ts` → face engine (`VITE_FACE_API_URL`, optional `VITE_FACE_API_KEY` sent as `X-API-Key`).
- `src/hooks/useRealtimeTranscription.ts` → STT service (`VITE_STT_API_URL`), see the realtime flow below.
- `src/hooks/useFaceDetection.ts` runs `@vladmandic/face-api`'s tiny face detector in a Web Worker (`src/workers/faceDetection.worker.ts`, model weights loaded from jsDelivr) for the live oval/bbox overlay only. Recognition itself is done server-side by `face-recognitions/`.

## Speech-to-text (`cd speech-to-text`)

```bash
docker compose up -d postgres redis rabbitmq
cp .env.example .env               # DATABASE_URL=postgresql://stt:stt@localhost:5432/stt to match docker-compose
npm install && npx prisma migrate dev
export PATH="$PWD/bin:$PATH"       # bin/ffmpeg, bin/ffprobe: wrappers that fix a broken Homebrew x265 dylib on one dev Mac
npm run dev                        # API (tsx watch src/index.ts)
npm run worker                     # RabbitMQ consumer; required for async/long jobs (202 responses)
npm test                           # node --test via tsx, all test/*.test.ts
node --import tsx --test test/pipeline.test.ts   # single test file
npm run build                      # tsc -> dist/ (start / start:worker run the compiled output)
```

`src/config.ts` validates env with zod at startup, so missing `STT_API_KEY` (min 8 chars), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `DATABASE_URL` crashes the process. Tests set dummy values themselves and need no real services. Preprocess tests are skipped when ffprobe is unavailable. ESM with NodeNext: relative imports must end in `.js`.

Architecture:
- `src/app.ts` `buildApp(config, deps)` registers plugins in order. `plugins/auth.ts` is a `fastify-plugin` global `onRequest` Bearer check against `STT_API_KEY`, so it covers every route registered after it. It explicitly exempts `/health`, `/v1/realtime/tokens`, and the WebSocket path. Adding a new public route means adding it to that exemption list.
- `POST /v1/transcriptions` (multipart) creates a `TranscriptionJob`, probes the duration, then either runs the pipeline inline (200) or publishes to RabbitMQ (202) when `options.async` is set or duration > `ASYNC_DURATION_THRESHOLD_SEC`. `GET /v1/transcriptions/:id` is used to poll.
- `modules/pipeline/run-transcription.ts` is shared by the inline path and `workers/transcription.worker.ts`: FFmpeg preprocess (16 kHz mono) → `stt/providers/gpt-transcribe.ts` → Claude refiner (`refiner/claude-refiner.ts`, skipped in `FAST` mode, must correct only, never translate) → `timestamps/normalize.ts` → persist segments plus `ProviderCall` rows → delete audio unless `retainAudio`.
- Realtime: the browser calls `POST /v1/realtime/tokens` (no auth) to get a short-lived HMAC token, opens `ws://…/v1/transcriptions/realtime?token=…`, sends a `session.start` JSON message, then binary webm/opus chunks (~5 s from MediaRecorder). `modules/realtime/session.ts` transcribes and refines each chunk and emits `transcript.partial` / `transcript.final` / `error` events. Realtime sessions are not persisted.
- Routes, pipeline and session take an injectable `deps` object (db, publish, runJob, sttProvider, refine, …). Tests pass fakes through `buildApp(config, deps)` rather than mocking modules.
- Provider keys (`STT_API_KEY`, OpenAI, Anthropic) must never go into `VITE_*` vars. Server-side consumers such as `backend/` call the REST API with `Authorization: Bearer $STT_API_KEY`. The integration examples are in `speech-to-text/README.md`.

## Face recognition (`cd face-recognitions`)

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt            # optional emotion model: requirements-emotion.txt (TensorFlow)
cp .env.example .env
python scripts/download_models.py          # InsightFace buffalo_s (~120 MB) into ~/.insightface
python api_pro.py                          # dev server on :9000 (entry point is app/main.py:create_app)
python scripts/smoke_test.py               # offline checks, no model weights needed
docker compose up --build                  # gunicorn, 1 worker
```

Python 3.12+ is unsupported (InsightFace/onnxruntime wheels). `app/pipeline.py` lazy-loads InsightFace on the first face request, so `/health` reports `insightface_lazy` until then. The gallery lives in `app/store.py` as in-memory L2-normalized embeddings persisted to `data/embeddings/{name}.npy`, with samples in `data/identities/{name}/samples/`. Matching is a cosine dot product against the `FACE_VERIFY_THRESHOLD` / `FACE_IDENTIFY_THRESHOLD` thresholds (rationale in `docs/THRESHOLDS.md`). `/enroll` accumulates samples and only commits (`committed: true`) once `FACE_MIN_ENROLL_SAMPLES` (3) is reached. Liveness (`app/liveness.py`) uses RGB heuristics unless `.onnx` anti-spoof models are placed in `models/anti_spoof/`. It is required on `/verify` by default. `FACE_API_KEY` empty means no auth. Legacy aliases `/create-dataset`, `/recognize`, `/delete-dataset` are still routed.
