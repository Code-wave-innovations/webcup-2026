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

Only `speech-to-text/` has tests. `project-plan/` holds the implementation plans that wire the features to the API, one per group of complementary Terra Nova codes, with a status table and the code→plan matrix in its `README.md`; extend those files rather than planning elsewhere. Design docs live in `docs/superpowers/specs/` and `speech-to-text/docs/` (SPEC.md is the source of truth for STT behavior; PLAN.md is the task checklist).

## Backend (`cd backend`)

```bash
docker compose up -d          # MySQL 5.7 on localhost:3300, phpMyAdmin on localhost:88 (credentials in docker-compose.yml)
cp .env.examle .env           # note the misspelled filename; set DATABASE_URL, optionally PORT and ENV=development
npm run dev                   # nodemon + ts-node running index.ts
npm run build                 # tsc -> dist/
npm start                     # node dist/index.js
npx prisma migrate dev        # apply schema.prisma changes (also regenerates the client)
npx prisma generate           # regenerate @prisma/client only
npm run seed                  # idempotent demo scenario (prisma/seed.ts + prisma/demoScenario.ts); SEED_RESET=1 recreates it
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
- Platform settings (D07/D08) live in `lib/settings.ts`: each key has a zod schema, a default and a `public` flag, stored as `PlatformSetting` rows (a key without a row uses its default, so a new key needs no migration). `getSetting()` caches for 30 s per process. `registration_open` is checked by `register`, `assertNotInMaintenance()` by request creation and booking (staff exempt), `reminder_default_minutes` by booking. `CORS_ORIGINS` (comma-separated) restricts CORS; unset allows every origin.
- The seed's demo scenario (`prisma/demoScenario.ts`) mirrors the back-office mockups and is laid out relative to the time it runs. Its rows have natural keys (`NT-DEMO-*`, `RDV-DEMO-*`, titles, emails); without `SEED_RESET=1` existing rows are kept, so changes made while testing survive a re-run.
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

Install: `npm ci --legacy-peer-deps` (the `package-lock.json` was regenerated; the old `edgesOut` error came from an incomplete lockfile). Dependencies are also tracked in `yarn.lock` (yarn 1; add `--ignore-engines`, `camera-controls` declares Node ≥ 22). To add a dependency: `npm install --package-lock-only --legacy-peer-deps <pkg>`, then `git checkout yarn.lock && yarn add <pkg> --ignore-engines`, because npm also rewrites every resolved URL of an existing `yarn.lock`. The `.pnp.cjs` files are unused leftovers.

`tsconfig.app.json` enables `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no enums, namespaces, or parameter properties).

Routes are declared in `src/app/App.tsx`:
- `/` (airlock login) and `/ville` (citizen app) run inside `FilmLayout`, which mounts the persistent three.js scene. `/ville` itself is the scroll-driven flyover; every other `/ville/*` page renders inside `pages/Console/ConsoleLayout` (see below). `/ville/test` (dev only) checks the API chain.
- `/equipe` is the team page.
- `/agent/*` and `/admin/*` lazy-load the staff back-office (`src/backoffice/`) outside the film layout.

The citizen app ("NOVA") is styled with CSS Modules reading the design tokens of `src/styles/tokens.css` (`@theme static`, e.g. `--color-ice`, `--color-glass`, `--font-display`). The look is dark glass, cut corners via `clip-path` rather than border-radius, and a cyan "ice" light. Shared primitives live in `src/ui/`, feature widgets in `src/features/`, and state in zustand stores.

### Data layer (`src/api/`)

Both spaces (citizen and back-office) reach the Express API only through `src/api/`; screens never call axios directly.
- `client.ts` owns the axios instances (`http`, `fileHttp`; `hooks/useHttps.ts` re-exports them). They add `Authorization: Bearer` from the session and reject with an `ApiError` (`errors.ts`: `status`, stable `code`, `details`, `retryAfter`). Show `messageFor(error)` (French) to users and put `fieldErrors(error)` (zod details, translated) on form fields.
- `session.ts`: one JWT session for all roles, persisted in `localStorage` (`nova-auth`). `signIn`/`signOut` reset the active queries and drop the others. Never use `queryClient.clear()` for this: it leaves the queries on screen pending forever. A `401 UNAUTHORIZED` ends the session and dispatches `nova:session-expired` (`onSessionExpired()`); a wrong password is `INVALID_CREDENTIALS`, not an expiry. The airlock still uses the demo `features/auth` session until PLAN-01.
- Server state uses TanStack Query (`queryClient.ts`, refresh intervals in `REFRESH`). Add one file per domain with a `xxxKeys` factory, `useXxx` queries and `useXxx` mutations that invalidate their keys (`settings.ts` is the model). Hooks never toast; the screen decides.
- Contracts live in `types.ts`, added domain by domain as plans bind them (`Paginated<T>` = `{ data, meta }`).
- Forms (F42): `ui/Field` takes a render prop that receives `id`, `aria-describedby`, `aria-invalid` and `required`. `hooks/useApiForm` blocks double submits, maps API errors onto fields and focuses the `ErrorSummary` (`summaryId`) after a failure. The back-office has its own `Field`/`ErrorSummary` with the same contract.

Console pages (`pages/Console/`): `ConsoleLayout` lays a reading surface over the dimmed city. Its `directorStore.console` flag hides the loading screen, and `Film`'s `FrameLoopGovernor` switches R3F to `frameloop="demand"` once the camera reaches the overview pose. Each page wraps its content in `ConsolePage`, which sets the document title, focuses its `h1` and renders the breadcrumbs from a `crumbs` prop. `useMatches()`/route handles are unavailable because `App.tsx` uses `<BrowserRouter>`. Guards live in `app/guards.tsx` (`RequireSession`, `RequireRole`). Call `rewindToCockpit()` (`app/airlock.ts`) before sending someone from the city to the airlock. `src/dev/DevLogin.tsx` signs in with the seed accounts in development until the real login screens exist.

### Back-office (`src/backoffice/`)

The agent and admin dashboards are a separate area: don't import it from the citizen app. It is being bound to the API plan by plan (`project-plan/`). `admin/pages/SettingsPage` is bound; the other screens still read simulated zustand stores (`stores/`) seeded from `mocks/`, whose types in `mocks/types.ts` mirror the backend's Prisma models and API responses.
- **Binding the API:** replace each store action (`changeStatus`, `assignRequest`, `createAlert`…) with a hook from `src/api/`, documented in `backend/README.md`, and keep the screen's loading (`Skeleton`) and error states. A bound page reads no store. Delete a store and its mock once no page reads them. The simulated actions call `recordAudit()` client-side; the server audit table (F47/F48, PLAN-10) will replace it, with `AuditLog` in `mocks/types.ts` as the intended contract.
- **Persona:** decided by the URL (`layout/persona.ts`): `/agent` acts as Alex (AGENT), `/admin` as Ada (ADMIN). The routes are not guarded yet (PLAN-01); bound screens show a sign-in state on 401/403.
- **Structure:** `layout/` holds the shell (sidebar, top bar, ⌘K palette, boot sequence), `ui/` its own primitives (`Panel`, `DataTable`, `Drawer`/`Modal`, `StatTile`…), `charts/` hand-made SVG charts animated with `motion`, `shared/` business components used by both spaces, and `agent/pages`/`admin/pages` the screens. Navigation and each screen's Terra Nova request codes live in `nav.ts`.
- **Lint constraints** (React Compiler rules): don't call `Date.now()` during render (use `useNow()` from `lib/useNow.ts`), and don't reassign variables inside render callbacks.
- **Charts:** the categorical colors (`--series-1..3` in `charts/Charts.module.css`) were validated for colorblind safety on the dark surface. Every chart has a table view through `ChartFrame`.

Service URLs come from `frontend/.env` (copy `.env.example`, typed in `src/vite-env.d.ts`, restart `npm run dev` after changes). Each service has its own client:
- `src/api/client.ts` (re-exported by `src/hooks/useHttps.ts`) → Express backend (`VITE_BASE_URL`, `VITE_API_URL`, `VITE_IMG_URL`). Module-level axios instances, stable across renders: `http` (JSON) and `fileHttp` (multipart, for endpoints with file fields).
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
