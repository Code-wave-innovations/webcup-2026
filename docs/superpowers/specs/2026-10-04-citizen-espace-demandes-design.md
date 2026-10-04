# Citizen space + Mes demandes (D11 / F26) — design

**Date:** 2026-10-04  
**Product:** Terra Nova citizen app (`frontend/`) over Express requests API (`backend/`).  
**Refs:** D11 · F26 (slice of PLAN-01 « Mon espace » + PLAN-03 citizen follow-up).  
**Scope:** Menu on city flyover and console, hub `/ville/espace`, list and detail of the signed-in citizen’s requests with a public timeline. No new backend endpoints.

## Problem

A resident who already filed several requests needs one place to see them, their current status, and the main steps already taken — without calling city hall.

## Approach

Wire the existing `GET /api/requests` and `GET /api/requests/:id` (events already filtered for citizens) into new console pages. Share a small nav between `CityChrome.TopBar` and `ConsoleTopBar`. Do not build contact / incident / procedure forms in this lot.

## Routes

| Path | Guard | Role |
|------|-------|------|
| `/ville/espace` | `RequireSession` | Hub « Mon espace » |
| `/ville/espace/demandes` | `RequireSession` | List (tabs + search) |
| `/ville/espace/demandes/:id` | `RequireSession` | Detail + frise + public events |

Other citizen’s ids already return **404** from the API; the UI shows the console not-found pattern.

Mounted under the existing `ConsoleLayout` outlet in `App.tsx` (veil + `ConsoleTopBar` + main).

## Navigation

**Shared links** (real destinations only in this lot):

- Accueil → `/ville`
- Mon espace → `/ville/espace`

**Placement:**

1. **Flyover** `CityChrome.TopBar`: keep section anchors; add « Mon espace » as a `Link` to `/ville/espace`.
2. **Console** `ConsoleTopBar`: replace the single « Accueil de la ville » link with Accueil + Mon espace; mark `aria-current` from the pathname.

**Badge (in scope):** on « Mon espace », show the count of requests with status `WAITING_CITIZEN` via `useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })` and `meta.total`. Hide the badge when 0 or when logged out.

**Out of this menu for now:** Services, Contact, Search, Urgences (pages not delivered yet). Avoid dead links.

## Hub `/ville/espace`

- Greeting: « Bonjour {name} », plus `user.district?.name` when the session user includes it.
- One actionable card: **Mes demandes** — open count (`scope=open`) and « à compléter » count (`WAITING_CITIZEN`), link to `/ville/espace/demandes`.
- No placeholder cards for appointments or notifications (YAGNI until PLAN-04 / PLAN-05).
- Loading / error states with retry; empty open list is still a valid hub (card shows 0).

## List `/ville/espace/demandes`

**Tabs** (filters kept in the URL query string):

| Tab | API filter |
|-----|------------|
| En cours | `scope=open` |
| À compléter | `status=WAITING_CITIZEN` |
| Terminées | `scope=closed` |
| Toutes | no scope/status |

Plus `q` (search) and server pagination (`page` / `limit`).

**Row content:** type label + icon · subject · reference · status pill (citizen wording) · relative `updated_at` · short « next step » hint derived from status.

**Empty state:** explain that no request matches; link back to `/ville` (creation forms are out of scope).

## Detail `/ville/espace/demandes/:id`

1. **Header:** type, subject, reference (copy button), status pill.
2. **Frise (timeline steps):** visual progress for the citizen, not raw API codes.

| API status | Step shown | Frise position |
|------------|------------|----------------|
| `SUBMITTED` | Reçue | step 1 active |
| `IN_REVIEW` | En examen | step 2 |
| `IN_PROGRESS` | En cours | step 3 |
| `WAITING_CITIZEN` | Votre réponse est attendue | step 3 with alert emphasis (same index as En cours) |
| `RESOLVED` | Résolue | step 4 done |
| `CLOSED` | Clôturée | terminal (all steps done, label Clôturée) |
| `REJECTED` | Refusée (+ motif from last public `COMMENT` / status note when present) | terminal failed (frise stops, error tone) |

Canonical mapping lives in **`frontend/src/api/requestStatus.ts`** (labels + step index + next-step hint). Citizen UI imports only this module; do not duplicate `CITIZEN_STATUS_LABEL` from the back-office in this lot (back-office can migrate later).

3. **Event history:** public `events` from the detail payload, **newest first**, each with who (author name when available, else « Service municipal »), what (event type label), when, optional message.
4. **Citizen reply:** `POST /api/requests/:id/comments` via existing `useAddComment`. Field highlighted when status is `WAITING_CITIZEN`.
5. **Recap block:** location, attachment link (`imgUrl`), procedure `data` when present.
6. **Refresh:** `useRequest` already polls every `REFRESH.openRequest` (30 s). Leave that as-is for all detail views in this lot (simple; closed requests are cheap). No WebSocket.

## Data layer

Reuse `frontend/src/api/requests.ts`:

- `useRequests(filters)` for list + hub counters + badge
- `useRequest(id)` for detail
- `useAddComment()` for replies

No axios calls from pages. Session from `api/session` (`RequireSession`).

## UI conventions

- Pages wrap `ConsolePage` (title focus, breadcrumbs: Accueil › Mon espace › …).
- Visual language: existing console / tokens (`tokens.css`), cut corners, no new design system.
- Status never shown as raw codes (`IN_REVIEW`, etc.).
- Forms use `Field` / `useApiForm` for the comment box (F42 baseline).

## Backend

**No schema or route changes.** Citizens already see only their requests; internal events are stripped server-side.

## Non-goals

- Contact / signalement / démarche create flows (D04, F25, procedure form)
- Back-office binding or `requestStore` removal
- 3D signal beam sync (`setSignalStatus`)
- `/ville/espace/profil`, attention feed (`/api/me/attention`), full PLAN-02 top-bar (Services, Recherche, Urgences)
- Fake RDV / notification cards on the hub

## Acceptance

1. Signed-in citizen opens Mon espace from flyover and from console; badge reflects waiting replies when > 0.
2. List shows own open/closed requests with citizen status labels; search finds closed ones (F26).
3. Detail shows frise + dated public steps; agent internal notes never appear.
4. When status is `WAITING_CITIZEN`, citizen can post a comment and see it in the history after refresh.
5. `npm run typecheck` / `lint` / `test` pass in `frontend/`.
