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
npm test          # vitest, src/**/*.test.ts
npm run preview
```

Install: the repo carries Yarn PnP files (`.pnp.cjs`) and a `package-lock.json` that npm 10.8 fails to resolve (`edgesOut` error). `npm install --no-package-lock --legacy-peer-deps` creates `node_modules` without touching tracked files.

`tsconfig.app.json` enables `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no enums, namespaces, or parameter properties).

With the PnP install, `yarn <script>` and `yarn vitest run` also work. In a non-interactive shell, give vitest `< /dev/null`, otherwise it can wait on stdin. There is no Prettier config: the code uses single quotes, no semicolons and lines up to about 180 columns (`prettier --no-semi --single-quote --print-width 180` matches it). Prettier's defaults would rewrite whole files.

Routes are declared in `src/app/App.tsx`:
- `/` (airlock login), `/ville` (citizen app) and `/nova` (chat with Nova, lazy) run inside `FilmLayout`, which mounts the persistent three.js scene.
- `/equipe` is the team page. `/dev/nova` (dev builds only) is Nova's test bench: gestures, postures, emotions, and a GLB dropped onto it is checked against the rig contract.
- `/agent/*` and `/admin/*` lazy-load the staff back-office (`src/backoffice/`) outside the film layout.

The citizen app ("NOVA") is styled with CSS Modules reading the design tokens of `src/styles/tokens.css` (`@theme static`, e.g. `--color-ice`, `--color-glass`, `--font-display`). The look is dark glass, cut corners via `clip-path` rather than border-radius, and a cyan "ice" light. Shared primitives live in `src/ui/`, feature widgets in `src/features/`, and state in zustand stores.

### The film (`src/experience/`)

The citizen routes play one continuous film in a single R3F `<Canvas>` that is never unmounted. The flow goes from the cockpit and login, through the atmospheric entry, to the city flyover driven by the scroll and the Observatory at night for the chat.
- **Director** (`director/`): `director` (a `FilmDirector`) owns the phase (`approach` → `entry` → `descent` → `city`, plus `explore`), the scroll position, the entry timeline and the film controls read by the post-processing.
  - `useDirectorStore` holds the low-frequency state for React.
  - `frameState` and `frameBus` carry per-frame values (screen anchors, Nova's on-screen box) to the DOM without React renders.
  - The entry is a paused GSAP timeline (`timelines/entryTimeline.ts`) that is seeked to the film clock, so "skip" and the debug jumps are just seeks.
- **Frame order**: `useFrame` priorities come from `framePriority.ts`: director, then stage, then details, then the water reflection, then render (1). Any positive priority takes over rendering, so new per-frame work must pick one of these slots.
- **Layers**: Nova and overlays (clouds, dust) live on `NOVA_LAYER`. The lake's mirror camera skips that layer, so Nova never appears in the reflection.
- **Nova** (`nova/`): a GLB rig (`rig/`, `public/models/nova.glb`) with procedural gestures as fallbacks (`animation/poseLibrary.ts`), a shader-drawn face (`face/`), and placement per stage (`stage/`). The `novaBrain.ts` state machine is pure: gesture > posture > walk > talk.
- **Features never import Nova.** They publish typed events: `LoginActivity`, the `ChatEvent` of `useNovaChat`, the reports… Each page translates them into `nova/behavior/scenes.ts` calls (`pages/*/useNova*Reactions.ts`). Keep that direction when adding a feature.
- **Sound** (`audio/`): synthesized with WebAudio, no audio files. It is off by default; the `SoundToggle` (desktop only) turns it on and the choice is kept in `localStorage`.
  - `sounds.ts` is the score as pure data, and `reactionSounds()` maps Nova's state changes to sounds. Nova's state of mind is therefore its voice: a new reaction needs no sound code.
  - `SoundDirector` adds the interface clicks (DOM delegation) and the ambience beds driven by the director's cues.
- **Quality** (`quality/`): `detectQuality` picks the light profile (phones, small GPUs). `ResolutionGovernor` lowers the pixel ratio at most twice when the city runs below 27 fps, but only if GPU timer queries show the GPU is the bottleneck (when they are available).
- **Reduced motion**: `director.reducedMotion` gives instant camera moves, a short fade instead of the entry, and no shake, plasma or blur. `base.css` also kills CSS animations.

Debug URL switches (`director/debugParams.ts`) frame a given moment for screenshots:
- `?vue=0..5` lands at a city section and signs in with the demo resident; it works on `/ville` and `/nova`.
- `?entree=<s>` jumps into the entry, `?arrivee=<0..1>` into the descent, and `?fige=1` freezes the entry.
- `?heure=<0..1>` sets the time of day; `?qualite=<scale>`, `?ldr=1` and `?sansaa=1` override the quality.
- In dev builds, `window.__nova` (`director`, `gl`, `profile`) and `window.__novaStore` are exposed for test drivers.

Headless Chrome caps frames near 30 fps whatever the scene costs, so judge performance with GPU timer queries and `gl.info`, not with fps.

### Back-office (`src/backoffice/`)

The agent and admin dashboards are a separate area: don't import it from the citizen app, and don't modify client files for it. It is still design-only: every screen reads simulated zustand stores (`stores/`) seeded from `mocks/`, whose types in `mocks/types.ts` mirror the backend's Prisma models and API responses.
- **Binding the API:** replace each store action (`changeStatus`, `assignRequest`, `createAlert`…) with the matching `/api` call, documented in `backend/README.md`. Every action also calls `recordAudit()`. The backend has no audit table yet (F47/F48): `AuditLog` in `mocks/types.ts` is the intended contract.
- **Persona:** decided by the URL (`layout/persona.ts`): `/agent` acts as Alex (AGENT), `/admin` as Ada (ADMIN). The routes are not guarded yet.
- **Structure:** `layout/` holds the shell (sidebar, top bar, ⌘K palette, boot sequence), `ui/` its own primitives (`Panel`, `DataTable`, `Drawer`/`Modal`, `StatTile`…), `charts/` hand-made SVG charts animated with `motion`, `shared/` business components used by both spaces, and `agent/pages`/`admin/pages` the screens. Navigation and each screen's Terra Nova request codes live in `nav.ts`.
- **Lint constraints** (React Compiler rules): don't call `Date.now()` during render (use `useNow()` from `lib/useNow.ts`), and don't reassign variables inside render callbacks.
- **Charts:** the categorical colors (`--series-1..3` in `charts/Charts.module.css`) were validated for colorblind safety on the dark surface. Every chart has a table view through `ChartFrame`.

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
