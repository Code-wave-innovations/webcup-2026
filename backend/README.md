## Terra Nova API

### Setup

```bash
docker compose up -d
cp .env.examle .env      # set DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed             # demo scenario (password NovaTerra2026! unless SEED_PASSWORD is set)
SEED_RESET=1 npm run seed   # deletes the demo scenario (NT-DEMO-*, RDV-DEMO-*, seeded contents) and recreates it
npm run dev
```

Demo accounts: `admin@novaterra.local` (Ada) and `noa.admin@novaterra.local`; agents `agent@novaterra.local` (Alex), `hanta.agent@` and `tiana.agent@novaterra.local`; citizens `citoyen@novaterra.local` (Lucas, Quartier Sud) and `senior@novaterra.local` (Jean, vulnerable), plus eight `@mail.nt` citizens, among them `miora.haja@mail.nt`, locked for 15 minutes after each seed run (F37), and `fara.tsiry@mail.nt`, deactivated. The scenario (18 requests with their timeline, slots, 12 appointments, announcements, alerts, interruptions, login attempts) is laid out around the moment the seed runs.

### Conventions

- Auth: `Authorization: Bearer <token>` (token returned by `/api/auth/register` and `/api/auth/login`).
- Roles: `CITIZEN`, `AGENT`, `ADMIN`. "Staff" = `AGENT` + `ADMIN`.
- Paginated lists return `{ data, meta: { page, limit, total, pages } }` and accept `?page=&limit=`.
- Errors return `{ error: { code, message, details? } }` (400 validation, 401, 403, 404, 409 duplicate).
- Translated content: add `?lang=en` (otherwise the user's locale, then `Accept-Language`, then `fr`).
- File fields are sent as `multipart/form-data` (jpg, png, webp, gif, pdf, 10 MB max) and served from `/public/<file>`.

### Endpoints

| Method & path | Access | Feature |
|---|---|---|
| `POST /api/auth/register` (JSON or multipart; optional file `profile`) · `POST /api/auth/login` · `GET /api/auth/exists?email=` (`{ exists }`, no session) · `GET /api/auth/by-email?email=` (passwordless session, same payload as login; still asks the code when the account has a second factor) | public | D01, D03 |
| `POST /api/auth/2fa/verify { challenge_token, code \| recovery_code }` · `POST /api/auth/2fa/setup { setup_token }` · `POST /api/auth/2fa/activate { setup_token, code }` | public (step tokens) | F53 |
| `POST /api/auth/passkey/options { email? }` · `POST /api/auth/passkey/verify { challenge_token, response }` | public | D02 |
| `GET/PATCH /api/me` · `PATCH /api/me/password` · `POST /api/me/onboarding/complete` | logged in | D03, D12, D14, F23/F24 (`preferences`) |
| `GET /api/me/security` · `DELETE /api/me/devices/:id` · `POST /api/me/sessions/revoke` (new token) · `POST /api/me/2fa/setup\|enable\|disable` · `POST /api/me/passkeys/register/options\|verify` · `GET /api/me/passkeys` · `DELETE /api/me/passkeys/:id` | logged in | D02, F53, F54 |
| `DELETE /api/me` body `{ password, confirm: true }` | citizen | F33 |
| `GET /api/users` · `GET/PATCH/DELETE /api/users/:id` · `POST /api/users/:id/unlock-login` | staff (agents: citizens only, no email/password/role changes) | D08, D09, F34 |
| `GET /api/users/staff` | staff | F22 (active agents and admins a request can be assigned to) |
| `POST /api/users` | admin | D08 |
| `GET /api/security/overview` (adds `locked_accounts`, `two_factor`) · `GET /api/security/login-attempts` · `GET /api/security/new-devices?hours=24` | admin | F37, F53, F54 |
| `GET /api/users/stats` · `GET /api/users/:id/security` · `GET /api/users/:id/devices` · `POST /api/users/:id/revoke-sessions` · `POST /api/users/:id/2fa/reset` · `DELETE /api/users/:id/passkeys` | admin | D08, F53, F54, D02 |
| `GET /api/audit-logs?actor_id=&entity=&entity_id=&action=&from=&to=&q=&page=` | staff (agents: no `security.*`/`auth.*` entry, no IP) | F47, F48 |
| `GET /api/audit-logs/export.csv` (same filters, UTF-8 with BOM, `;`) · `GET /api/audit-logs/stats?days=14` | admin | F47 |
| `GET /api/permissions` | staff | D08, D09 (the roles matrix of `src/lib/permissions.ts`) |
| `GET /api/services/:id/impact` | staff | F63 |
| `POST /api/services/:id/disable { reason, alternative?, back_at?, notify_open_requests? }` · `POST /api/services/:id/enable` | admin | F63 (an INCIDENT/UNAVAILABLE interruption; the service stays visible) |
| `GET /api/home` | public | D07 (alerts, featured services, categories, news) |
| `GET /api/search?q=` | public (+ own requests when logged in) | F32 |
| `GET /api/services?category=&featured=&q=&sort=` · `GET /api/services/:idOrSlug` | public | D05, F28 |
| `POST /api/services` · `PATCH/DELETE /api/services/:id` | admin | D05 |
| `GET /api/service-categories[/:idOrSlug]` · write: admin | public | D05 |
| `GET /api/procedures?service_id=` · `GET /api/procedures/:idOrSlug` · write: admin | public | D11, D12 |
| `GET /api/districts[/:id]` · write: admin | public | F25, F29 |
| `GET /api/translations/schema` · `GET/PUT /api/translations` · `DELETE /api/translations/:id` | admin | F27 |
| `POST /api/requests` | public for `CONTACT`, logged in otherwise | D04, D11, D16, F25 |
| `GET /api/requests?scope=open\|needs_action\|closed&status=&type=&priority=&district_id=&assigned=me\|none\|<id>&citizen_id=&q=&sort=` | citizen: own · staff: all (`citizen_id` staff only) | F22, F26 |
| `GET /api/requests/:id` · `POST /api/requests/:id/comments` | owner or staff | D11 |
| `PATCH /api/requests/:id` (status, priority, assigned_agent_id, note, internal_note) | staff | F22, F49 (`WAITING_CITIZEN`, `REJECTED`, `RESOLVED` need a public `note`, else 400 on `note`; the response adds `citizen_notified`; an `ASSIGNED` event keeps the assignee's name in `message`) |
| `POST /api/requests/bulk { ids, assigned_agent_id?, priority? }` | staff | F22, D17 (one event per request) |
| `DELETE /api/requests/:id` | admin | |
| `GET /api/dashboard/stats` | staff | D17, D19, F22, F25 (adds `open_by_agent`, `overdue`/`overdue_count`, `incidents_by_district`, `appointments.today`) |
| `GET /api/dashboard/trends?days=14` | staff | D19 (per day: created/resolved by type, new citizens, appointments, median pickup; median pickup per service; weekday × 2 h heatmap) |
| `GET /api/dashboard/activity?limit=10` | staff | F22, D19 (latest staff events on requests, until the audit log) |
| `GET /api/dashboard/summary?period=today\|7d\|30d` | staff | F50 (indicators vs the previous period, `watch` list with server-written labels; overdue delays in `OVERDUE_HOURS`) |
| `GET /api/announcements` · `GET /api/announcements/:id` | public | D06 |
| `POST /api/announcements` · `PATCH /:id` · `POST /:id/publish` · `DELETE /:id` | staff | D06, F30 |
| `GET /api/alerts/active` · `GET /api/alerts/:id` | public | D18, F29, F31 |
| `GET /api/alerts` · `POST /api/alerts` · `PATCH /:id` · `POST /:id/close` | staff | D18, F29, F31 |
| `GET /api/notifications` · `GET /unread-count` · `PATCH /:id/read` · `POST /read-all` · `DELETE /:id` | logged in | F30 |
| `GET /api/service-interruptions?service_id=&scope=current\|upcoming\|active\|all` | public | F38 |
| `POST /api/service-interruptions` · `PATCH /:id` · `POST /:id/end` · `DELETE /:id` | staff | F38 |
| `GET /api/transit/lines` · `/lines/:idOrCode?day=` (stops with `times` and `times_by_direction`) · `/stops?district_id=&q=` · `/stops/:id?day=&at=` · `/disruptions` | public | F36 |
| `POST/PATCH/DELETE /api/transit/lines[/:id]` · `PATCH /lines/:id/status` · `PUT /lines/:id/stops` · `PUT /lines/:id/timetable` (`departures` list, or `first`/`last`/`every_minutes`/`minutes_between_stops`/`return_trip` generated in both directions by default) · stops CRUD | staff | F36 |
| `GET /api/appointments/slots?service_id=&from=&to=` | public | F39 |
| `POST /api/appointments/slots` · `POST /slots/bulk` · `PATCH/DELETE /slots/:id` | staff | F39 |
| `POST /api/appointments` · `GET /api/appointments` · `GET /:id` · `GET /:id/ics` · `POST /:id/cancel` · `PATCH /:id/reminder` | logged in (own) / staff | F39, F40 |
| `PATCH /api/appointments/:id` (status, agent_notes) · `POST /api/appointments/reminders/run` | staff · admin | F39, F40 |
| `GET /api/terra-nova/requests` | staff | D19 (needs `TERRA_NOVA_API_KEY`, sent as `X-Webcup-Api-Key`) |
| `GET /api/settings/public` | public | D07, D08 (home blocks, registrations, maintenance, contacts, emergency numbers, default reminder) |
| `GET /api/settings` · `PATCH /api/settings` (any subset of keys) | admin | D07, D08, F37 (`security` thresholds read-only, `updated` = who changed each key) |

### Platform settings

Keys, validation and defaults are defined in `src/lib/settings.ts`. When an admin turns on `maintenance_mode`, citizens get `503 MAINTENANCE` (with `maintenance_message`) when they create a request or book an appointment; staff are not affected. When `registration_open` is off, registration returns `403 REGISTRATION_CLOSED`. A booking without `reminder_offset_minutes` uses `reminder_default_minutes`. Set `CORS_ORIGINS` (comma-separated) to restrict the allowed front-end origins.

### Request types

`POST /api/requests` body: `type` (`CONTACT` | `PROCEDURE` | `INCIDENT`), `subject`, `message`, plus:
- `CONTACT` without account: `contact_name`, `contact_email`.
- `PROCEDURE`: `procedure_id` and `data` (answers to the procedure's `form_schema`; required fields are checked).
- `INCIDENT`: `location_label` or `latitude` + `longitude`; optional `category`, `district_id`, `attachment` file.

The response contains `reference` (e.g. `NT-261003-4F9A2C`) and a confirmation `message`. A request on a service that is currently interrupted returns `409 SERVICE_UNAVAILABLE` with `reason`, `alternative` and `back_at`.

### Audit (F47, F48)

Every staff mutation calls `audit(req, { action, entity, entityId, label, before, after, fields, metadata })` from `src/lib/audit.ts` after it succeeded. Only the listed `fields` are compared; secrets are never copied and a citizen's phone and address are only marked as changed. Writing an entry never makes the action fail. The table is immutable: no route updates or deletes an entry, and nothing purges it. The seed adds a few entries flagged `metadata.demo`.

### Roles matrix (D08, D09)

`src/lib/permissions.ts` describes who can do what and which routes apply it. `npm run check:permissions` reads the routers and fails when a route guarded by `requireStaff`/`requireAdmin` is missing from the matrix or declared with another guard: add the route there whenever you add one.

### Sign-in security (D02, F53, F54)

- **Sessions:** the JWT carries the account's `token_version` (`tv`); bumping it (« déconnecter tous les appareils ») makes older tokens fail with `401 SESSION_REVOKED`. Step tokens (`purpose`: 2FA challenge, setup, passkey ceremony) are never accepted as sessions.
- **Devices (F54):** the front sends `X-Device-Id` (random id kept in `localStorage`); a sign-in from an unknown device on an account that already has one sends a `SECURITY` notification and writes `security.new_device`.
- **Second factor (F53):** TOTP (`otplib`, one period of drift) with 8 single-use recovery codes. A password sign-in on an account with a second factor answers `{ two_factor_required, challenge_token }` (5 min); the setting `two_factor_required_roles` (empty by default) forces an account of those roles to set it up first (`{ two_factor_setup_required, setup_token }`). Wrong codes count as failed logins (F37).
- **Passkeys (D02):** `@simplewebauthn/server` (Node ≥ 20), configured with `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`. A passkey requires user verification and satisfies the second-factor policy.

### Security (F37)

- 5 wrong passwords for an email within 15 min lock it for 15 min; 20 from one IP block the IP. Responses: `401 INVALID_CREDENTIALS` with `remaining_attempts`, then `429 ACCOUNT_LOCKED`/`IP_BLOCKED` with `Retry-After`.
- The account owner gets a `SECURITY` notification, and the login response includes `security.failed_attempts_since_last_login`.
- Staff can lift a lock with `POST /api/users/:id/unlock-login`. Register, login and request creation are also rate limited per IP.

### Form anti-bot (anonymous CONTACT + register)

Layered protection (approach C) in `lib/formGuard.ts` and `lib/turnstile.ts`:

- Always: honeypot (`website` / `company` must be empty) and `form_started_at` (epoch ms, form must be ≥ 2 s old). Failures → `400 BOT_REJECTED`.
- Soft: after 2 successful posts from the same IP (15 min for contact, 1 h for register), or when the client IP is unknown, require Cloudflare Turnstile if `TURNSTILE_SECRET_KEY` is set → `403 TURNSTILE_REQUIRED` / `TURNSTILE_FAILED`.
- Hard: anonymous contact 5 / 15 min / IP and 3 / h / email; register 3 / h / email (plus the router’s 10 / h / IP) → `429 RATE_LIMITED` with `Retry-After`.
- Without `TURNSTILE_SECRET_KEY`, only honeypot, timing and hard limits apply (local dev). Pair the secret with the front’s `VITE_TURNSTILE_SITE_KEY`.

### Appointments (F39, F40)

Booking returns `when` (ISO dates, duration, time zone, readable label), `where`, `with`, `preparation` (notes, documents to bring, contact) and `calendar_url` (.ics with an alarm). Reminders are in-app notifications sent `reminder_offset_minutes` before the slot (default 1440) by a job that runs every minute in the API process.

### Deploying on cPanel

- cPanel serves Node apps through Passenger. After deploying, log in as admin and call `GET /api/security/client-ip`: if `x_forwarded_for` holds your IP, add `TRUST_PROXY=1` to the app's environment variables and restart. Without a known client IP, per-IP limits are skipped and only the per-account lock applies.
- Passenger stops idle apps, which pauses the in-process reminder job. Add a cPanel Cron Job every 5 minutes: `cd ~/<app folder> && <node path shown by cPanel> dist/src/jobs/sendReminders.js` (`npm run reminders` locally).
- Set `TZ` in the app's environment variables so timetables and appointment labels use the city's time zone.

### CRUD generator (simple tables)

``npm run generate:crud -- user name:string last_name:string:@unique profile:string:file email:string:@unique couverture:string:file``
