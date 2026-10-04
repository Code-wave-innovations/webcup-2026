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

Only `speech-to-text/` (node:test) and `frontend/` (vitest) have tests; the backend's checks are `typecheck` and `check:permissions`. `project-plan/` holds the implementation plans that wire the features to the API, one per group of complementary Terra Nova codes, with a status table and the code→plan matrix in its `README.md`; extend those files rather than planning elsewhere. `back-office-only-plan/` (BO-00…BO-10) re-groups the same codes by back-office screen and role and also covers the later waves (D02, F49–F68); backend work shared by both folders is done once and ticked in both. Design docs live in `docs/superpowers/specs/` and `speech-to-text/docs/` (SPEC.md is the source of truth for STT behavior; PLAN.md is the task checklist).

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
npm run typecheck             # tsc --noEmit
npm run check:permissions     # the roles matrix (src/lib/permissions.ts) declares every staff/admin route
npm run reminders             # one pass of the reminder job from dist/ (build first)
npm run generate:crud -- <table> <field>:<type>[:<modifier>] ...
```

Seed accounts: `admin@novaterra.local`, `agent@novaterra.local`, `citoyen@novaterra.local`, password `NovaTerra2026!` (`SEED_PASSWORD` overrides it).

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
- Face sign-in and account recovery (D03, F34): the browser never decides who someone is. `POST /api/auth/face` sends the frame to the face engine through `lib/faceGateway.ts` (`FACE_API_URL`, `FACE_API_KEY`, server-only) and opens the session only on a match; faces are enrolled with `POST /api/me/face`, for one's own account. A citizen who lost access gets a one-time code from an agent after an identity check (`POST /api/users/:id/reset-code`, `lib/resetCode.ts`, hash only, 30 min) and sets the new password themselves with `POST /api/auth/recover`. Agents never set a password and cannot delete an account (admins only); the holder is notified of every staff action on their account. Wrong codes and other faces count as failed logins.
- Login protection (F37) lives in `lib/loginGuard.ts` and is computed from the `LoginAttempt` table: an email locks after 5 failures in 15 min since its last success or staff unlock, an IP after 20. `lib/rateLimit.ts` is an in-memory, per-process limiter. Production runs on cPanel (Passenger behind Apache). There, `req.ip` can be undefined (Unix socket) or the proxy's, so `clientIp()` returns undefined when the IP is unknown and per-IP limits are skipped. `TRUST_PROXY=1` enables `X-Forwarded-For`; `GET /api/security/client-ip` shows what the app sees.
- Sign-in security (BO-05): sessions and short-lived step tokens (2FA challenge/setup, passkey ceremonies) are JWTs signed with the same secret and told apart by `purpose` (`lib/tokens.ts`). `authenticate` refuses step tokens and compares the session's `tv` with `User.token_version`, so bumping it signs out every device (`401 SESSION_REVOKED`). TOTP and recovery codes (F53) are in `lib/twoFactor.ts`, passkeys (D02) in `lib/webauthn.ts` (`WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`, defaulting to localhost), known devices (F54, from `X-Device-Id`) in `lib/devices.ts`.
- Anonymous public forms (contact, register) go through `lib/formGuard.ts`: a honeypot (`website`/`company`), a minimum fill time (`form_started_at`), soft and hard per-IP/per-email limits, and a Cloudflare Turnstile challenge (`lib/turnstile.ts`) only past the soft limit. Without `TURNSTILE_SECRET_KEY` the challenge is skipped and the rest still applies. The frontend counterpart is `features/security/` (`formGuardPayload`, `Turnstile`, `VITE_TURNSTILE_SITE_KEY`).
- `audit()` (`lib/audit.ts`, F47/F48) journals every staff mutation after it succeeds. It never fails the action, never stores secret fields and masks citizens' phone and address.
- D19: `GET /api/terra-nova/requests` proxies the organizers' feed (`TERRA_NOVA_API_KEY` sent as `X-Webcup-Api-Key`, 60 s cache, `?refresh=true` bypasses it).
- Service availability (F38) is derived from `ServiceInterruption` rows by `lib/availability.ts`. Service responses expose `availability` (`withAvailability`) instead of the raw relation. `serviceListInclude()` is a function because its filter depends on the current time. Creating a request or booking on an unavailable service throws `409 SERVICE_UNAVAILABLE`.
- `index.ts` calls `startScheduler()` (`lib/scheduler.ts`), which sends appointment reminders (F40) and the notifications of programmed alerts once they start (D18, `Alert.notify`/`notified_at`) every minute. Passenger stops idle apps, so production also runs `dist/src/jobs/sendReminders.js` from a cPanel Cron Job. Reminders and alert notifications are claimed atomically, so several runs or processes never send one twice. Timetables (`TransitDeparture.time` is "HH:MM" text) and slot labels use the process time zone (`TZ`).
- Alert targeting (`audience` ALL / DISTRICTS / VULNERABLE plus optional districts) is defined once in `alert.model.ts` (`audienceUserWhere`, `concernsUser`). Notifications are fanned out with `notifyUsers(where, …)`; `GET /api/notifications/audience` counts them before sending.
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
npm run typecheck # tsc -b
npm test          # vitest run, node environment, src/**/*.test.ts only (not .tsx)
npx vitest run src/features/auth/loginMachine.test.ts   # single test file
npm run preview
npm run model:nova [src.glb] [out.glb]   # rig + optimize Nova's mesh into public/models/nova.glb; runs the .ts with plain node (needs native TS support)
```

`scripts/tts/generate_mg.py` pre-generates Malagasy speech (Meta MMS-TTS) into `public/tts/`, which `useSpeakMessage` plays through `audioUrl`. It has its own Python 3.10–3.12 venv; setup is in the file's docstring.

Install: `npm ci --legacy-peer-deps` (the `package-lock.json` was regenerated; the old `edgesOut` error came from an incomplete lockfile). Dependencies are also tracked in `yarn.lock` (yarn 1; add `--ignore-engines`, `camera-controls` declares Node ≥ 22). To add a dependency: `npm install --package-lock-only --legacy-peer-deps <pkg>`, then `git checkout yarn.lock && yarn add <pkg> --ignore-engines`, because npm also rewrites every resolved URL of an existing `yarn.lock`. The `.pnp.cjs` files are unused leftovers.

`tsconfig.app.json` enables `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no enums, namespaces, or parameter properties).

With the PnP install, `yarn <script>` and `yarn vitest run` also work. In a non-interactive shell, give vitest `< /dev/null`, otherwise it can wait on stdin. There is no Prettier config: the code uses single quotes, no semicolons and lines up to about 180 columns (`prettier --no-semi --single-quote --print-width 180` matches it). Prettier's defaults would rewrite whole files.

Routes are declared in `src/app/App.tsx`:
- `/` (airlock login), `/ville` (citizen app) and `/nova` (chat with Nova, lazy) run inside `FilmLayout`, which mounts the persistent three.js scene. `/ville` itself is the scroll-driven flyover; every other `/ville/*` page renders inside `pages/Console/ConsoleLayout` (see below). `/ville/test` (dev only) checks the API chain.
- `/equipe` is the team page. `/face` (`components/Face/FaceUnlock`) and `/transcription` (`components/Realtime/RealtimeTranscription`) are standalone demos of the two companion services.
- `/agent/*` and `/admin/*` lazy-load the staff back-office (`src/backoffice/`) outside the film layout.
- `/dev/nova` (`dev/NovaBench`) is Nova's test bench, compiled out of production builds like `/ville/test`.

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
- **Alerts (D18):** `features/announcements/AlertCenter`, mounted in `FilmLayout`, reaches every citizen screen including the airlock. It polls `/api/alerts/active` (with the citizen session's token, for `concerns_me`), takes over the screen with `AlertTransmission` for each unread alert that concerns the visitor, then keeps it in a banner. What was read or folded is remembered per browser (`nova-alerts`). A critical alert that concerns the visitor sets `directorStore.alert` (red city, chime) and Nova reads its instructions. `alertFeedStore` shares the alerts with the pages.
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

### Data layer (`src/api/`)

Both spaces (citizen and back-office) reach the Express API only through `src/api/`; screens never call axios directly.
- `client.ts` owns the axios instances (`http`, `fileHttp`; `hooks/useHttps.ts` re-exports them). They add `Authorization: Bearer` from the session and reject with an `ApiError` (`errors.ts`: `status`, stable `code`, `details`, `retryAfter`). Show `messageFor(error)` (French) to users and put `fieldErrors(error)` (zod details, translated) on form fields.
- `session.ts`: one JWT session for all roles, persisted in `localStorage` (`nova-auth`). `signIn`/`signOut` reset the active queries and drop the others. Never use `queryClient.clear()` for this: it leaves the queries on screen pending forever. A `401 UNAUTHORIZED` ends the session and dispatches `nova:session-expired` (`onSessionExpired()`); a wrong password is `INVALID_CREDENTIALS`, not an expiry. The airlock still uses the demo `features/auth` session until PLAN-01.
- Server state uses TanStack Query (`queryClient.ts`, refresh intervals in `REFRESH`). Add one file per domain with a `xxxKeys` factory, `useXxx` queries and `useXxx` mutations that invalidate their keys (`settings.ts` is the model). Hooks never toast; the screen decides.
- Contracts live in `types.ts`, added domain by domain as plans bind them (`Paginated<T>` = `{ data, meta }`).
- Forms (F42): `ui/Field` takes a render prop that receives `id`, `aria-describedby`, `aria-invalid` and `required`. `hooks/useApiForm` blocks double submits, maps API errors onto fields and focuses the `ErrorSummary` (`summaryId`) after a failure. The back-office has its own `Field`/`ErrorSummary` with the same contract.

Console pages (`pages/Console/`): `ConsoleLayout` lays a reading surface over the dimmed city. Its `directorStore.console` flag hides the loading screen, and `Film`'s `FrameLoopGovernor` switches R3F to `frameloop="demand"` once the camera reaches the overview pose. Each page wraps its content in `ConsolePage`, which sets the document title, focuses its `h1` and renders the breadcrumbs from a `crumbs` prop. `useMatches()`/route handles are unavailable because `App.tsx` uses `<BrowserRouter>`. Guards live in `app/guards.tsx` (`RequireSession`, `RequireRole`). Call `rewindToCockpit()` (`app/airlock.ts`) before sending someone from the city to the airlock. `src/dev/DevLogin.tsx` signs in with the seed accounts in development until the real login screens exist.

### Back-office (`src/backoffice/`)

The agent and admin dashboards are a separate area: don't import it from the citizen app. It is being bound to the API plan by plan (`back-office-only-plan/`, BO-00 to BO-06 done). Still simulated: announcements and notifications (BO-07; alerts are bound), slots and appointments (BO-08) and translations (excluded); they read zustand stores (`stores/`) seeded from `mocks/`, whose types in `mocks/types.ts` mirror the backend's Prisma models. `userStore` and `catalogStore` only survive for `lib/lookups` on those screens. An unbound screen passes `simulated` to its `PageHeader`, which shows « Données simulées »; drop the prop when binding it.
- **Binding the API:** replace each store action (`createAlert`, `addSlots`…) with a hook from `src/api/`, documented in `backend/README.md`, and keep the screen's loading (`Skeleton`) and error states. A bound page reads no store. Delete a store and its mock once no page reads them. Every backend mutation you add calls `audit()` (`backend/src/lib/audit.ts`); objects show their history with `shared/EntityHistory`.
- **Accounts, rights, security:** `shared/AccountDrawer` (profile, security, history) serves `UsersPage` and `CitizensPage`; `shared/AccountPage` is « Mon compte » in both spaces. The roles matrix lives in `backend/src/lib/permissions.ts`: when you add a guarded route, declare it there (`npm run check:permissions` fails otherwise). The login page is a step machine (`layout/StaffLoginPage`: credentials or passkey, code, enforced setup, recovery codes); a `401 SESSION_REVOKED` ends the session with « Session révoquée ». The client sends `X-Device-Id` (`nova-device` in `localStorage`).
- **Access:** `/agent/connexion` and `/admin/connexion` (`layout/StaffLoginPage`) sign the staff in with `POST /api/auth/login` and refuse citizens without opening their session. Everything else sits behind `layout/RequireStaff`: no session → login page with `?retour=`, citizen → refusal screen, agent on `/admin` → `/agent`. On `nova:session-expired`, `sessionNotice.ts` flags the redirect so the login page adds `?expiree=1` and explains it. `usePersona()` is the space from the URL, `useActor()` the session's user; admins can switch to the agent view.
- **Shell data:** `useBadges()` reads real counters (`/dashboard/stats`, `/service-interruptions?scope=current`) and leaves a counter undefined, hence hidden, until an endpoint can give it; never show a simulated number next to real ones. The bell reads `/api/notifications`.
- **Structure:** `layout/` holds the shell (sidebar, top bar, ⌘K palette, boot sequence), `ui/` its own primitives (`Panel`, `DataTable`, `Drawer`/`Modal`, `StatTile`…), `charts/` hand-made SVG charts animated with `motion`, `shared/` business components used by both spaces, and `agent/pages`/`admin/pages` the screens. Navigation and each screen's Terra Nova request codes live in `nav.ts`.
- **Requests:** `src/api/requests.ts` (`useRequests` with filters kept in the URL, `useRequest`, `useUpdateRequest`, `useAddComment`, `useBulkUpdate`). The overdue rule (`OVERDUE_HOURS` by priority) exists on both sides: `backend/src/model/dashboard.model.ts` and `lib/thresholds.ts`. F49: `WAITING_CITIZEN`, `REJECTED` and `RESOLVED` need a public note (server 400 on `note`); `PATCH` answers `citizen_notified`.
- **Lint constraints** (React Compiler rules): don't call `Date.now()` during render (use `useNow()` from `lib/useNow.ts`), and don't reassign variables inside render callbacks.
- **Charts:** the categorical colors (`--series-1..3` in `charts/Charts.module.css`) were validated for colorblind safety on the dark surface. Every chart has a table view through `ChartFrame`.

Service URLs come from `frontend/.env` (copy `.env.example`, typed in `src/vite-env.d.ts`, restart `npm run dev` after changes). Each service has its own client:
- `src/api/client.ts` (re-exported by `src/hooks/useHttps.ts`) → Express backend (`VITE_BASE_URL`, `VITE_API_URL`, `VITE_IMG_URL`). Module-level axios instances, stable across renders: `http` (JSON) and `fileHttp` (multipart, for endpoints with file fields).
- `src/hooks/useFaceApi.ts` → face engine (`VITE_FACE_API_URL`, optional `VITE_FACE_API_KEY` sent as `X-API-Key`), for the `/face` demo and the airlock's demo accounts only. Real accounts go through the API (`features/auth/authService` `faceSignIn`, `linkOwnFace`); never put the production face key in a `VITE_*` variable.
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

`src/config.ts` validates env with zod at startup, so missing `STT_API_KEY` (min 8 chars), `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` or `DATABASE_URL` crashes the process (`OPENAI_API_KEY` is optional). Tests set dummy values themselves and need no real services. Preprocess tests are skipped when ffprobe is unavailable. ESM with NodeNext: relative imports must end in `.js`.

Architecture:
- `src/app.ts` `buildApp(config, deps)` registers plugins in order. `plugins/auth.ts` is a `fastify-plugin` global `onRequest` Bearer check against `STT_API_KEY`, so it covers every route registered after it. It explicitly exempts `/health`, `/v1/realtime/tokens`, the WebSocket path and `/v1/speech` (the last two check the realtime `?token=` themselves). Adding a new public route means adding it to that exemption list.
- `POST /v1/transcriptions` (multipart) creates a `TranscriptionJob`, probes the duration, then either runs the pipeline inline (200) or publishes to RabbitMQ (202) when `options.async` is set or duration > `ASYNC_DURATION_THRESHOLD_SEC`. `GET /v1/transcriptions/:id` is used to poll.
- `modules/pipeline/run-transcription.ts` is shared by the inline path and `workers/transcription.worker.ts`: FFmpeg preprocess (16 kHz mono) → Whisper through OpenRouter (`stt/providers/openrouter-stt.ts`, `OPENROUTER_STT_MODEL`, prompted with the Terra Nova/Malagasy glossary in `stt/terra-nova-glossary.ts`) → Claude refiner (`refiner/claude-refiner.ts`, must correct only, never translate; skipped in `FAST` mode or when `refiner/should-refine.ts` judges the text clean enough, e.g. confidence above `CONFIDENCE_FALLBACK_THRESHOLD`) → `timestamps/normalize.ts` → persist segments plus `ProviderCall` rows → delete audio unless `retainAudio`. `gpt-transcribe.ts` is a legacy provider that only its test still uses.
- Realtime: the browser calls `POST /v1/realtime/tokens` (no auth) to get a short-lived HMAC token, opens `ws://…/v1/transcriptions/realtime?token=…`, sends a `session.start` JSON message, then one binary webm/opus chunk per utterance. `useRealtimeTranscription` cuts utterances with a client-side energy VAD and restarts the MediaRecorder each time, so every chunk is a complete WebM with headers. `modules/realtime/session.ts` transcribes each chunk with the turbo model (`OPENROUTER_REALTIME_STT_MODEL`, no server speech gate by default), emits `transcript.partial` / `transcript.final`, then refines in the background and emits `transcript.refined` with the same `utteranceId` for the client to swap in. Realtime sessions are not persisted.
- Routes, pipeline and session take an injectable `deps` object (db, publish, runJob, sttProvider, refine, …). Tests pass fakes through `buildApp(config, deps)` rather than mocking modules.
- Nova's voice: `GET /v1/speech?text=&token=` (`routes/speech.ts`) asks Swiftask's text-to-speech bot (`POST /api/ai/elevenlabs`, `SWIFTASK_API_KEY`; the voice is a *name* of Swiftask's ElevenLabs account, `SWIFTASK_TTS_VOICE`), downloads the mp3, streams it and caches it on disk (`TTS_CACHE_DIR`; a new sentence takes 5–10 s, a cached one a few ms). The frontend's `useSpeakMessage` requests one recording per sentence and plays them in order; there is deliberately no browser-voice fallback (a line that cannot be fetched stays silent). `warmSpeech()` pre-generates the fixed lines when the sound is on.
- Provider keys (`STT_API_KEY`, OpenRouter, Anthropic) must never go into `VITE_*` vars. Server-side consumers such as `backend/` call the REST API with `Authorization: Bearer $STT_API_KEY`. The integration examples are in `speech-to-text/README.md`.

## Face recognition (`cd face-recognitions`)

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/download_models.py          # InsightFace buffalo_s (~120 MB) into ~/.insightface
python api_pro.py                          # dev server on :9000 (entry point is app/main.py:create_app)
python scripts/smoke_test.py               # offline checks, no model weights needed
docker compose up --build                  # gunicorn, 1 worker
```

Python 3.12+ is unsupported (InsightFace/onnxruntime wheels). `app/pipeline.py` lazy-loads InsightFace on the first face request, so `/health` reports `insightface_lazy` until then. The gallery lives in `app/store.py` as in-memory L2-normalized embeddings persisted to `data/embeddings/{name}.npy`, with samples in `data/identities/{name}/samples/`. Matching is a cosine dot product against the `FACE_VERIFY_THRESHOLD` / `FACE_IDENTIFY_THRESHOLD` thresholds (rationale in `docs/THRESHOLDS.md`). `/enroll` accumulates samples and only commits (`committed: true`) once `FACE_MIN_ENROLL_SAMPLES` (3) is reached. Liveness (`app/liveness.py`) uses RGB heuristics unless `.onnx` anti-spoof models are placed in `models/anti_spoof/`. It is required on `/verify` by default. `FACE_API_KEY` empty means no auth. Legacy aliases `/create-dataset`, `/recognize`, `/delete-dataset` are still routed.

## Production deployment

The backend runs on cPanel (Passenger; see `backend/README.md` « Deploying on cPanel »). `face-recognitions/` and `speech-to-text/` run on a VPS in the same way: `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` (from `.env.prod.example`), with the host's nginx on public :80/:443 proxying to Docker on :84 (face) and :85 (STT), and Let's Encrypt certificates for DuckDNS subdomains set up by `deploy/host-nginx/install-host-nginx.sh` and `deploy/certbot/init-ssl.sh`. The steps are in each service's README. The face container runs gunicorn on `passenger_wsgi:application`. Behind nginx, its rate limiter sees the proxy IP because there is no `ProxyFix` yet.
