# Citizen account deletion in Mon espace (F33) — design

**Date:** 2026-10-04  
**Product:** Terra Nova citizen app (`frontend/`) over Express `DELETE /api/me` (`backend/`).  
**Refs:** F33 (PLAN-01 § 4.4 slice) · D03 hub entry.  
**Scope:** Hub card + `/ville/espace/compte` + password confirmation dialog + post-delete airlock message. No profile edit, no password change, no backend changes.

## Problem

A resident must be able to delete their own account from Mon espace, with a clear irreversible flow, while an unattended or stolen session cannot delete the account without the password.

## Approach

Reuse the existing F33 API (`DELETE /api/me` with `{ password, confirm: true }`). Add a dedicated console page reached from the hub, explain consequences on the page, then confirm in a citizen-styled dialog. On success, clear citizen (+ film) session and return to the airlock with a status banner.

## Routes

| Path | Guard | Role |
|------|-------|------|
| `/ville/espace` | `RequireSession` | Hub — add **Compte** card |
| `/ville/espace/compte` | `RequireSession` | Consequences + open delete dialog |

Mounted under existing `ConsoleLayout` in `App.tsx`.

## Hub

Second card next to **Mes demandes**:

- Title: **Compte**
- Short lead: access to account deletion (this lot only).
- CTA: « Gérer mon compte » → `/ville/espace/compte`

## Page `/ville/espace/compte`

- Wrap `ConsolePage` — title « Compte », crumbs Accueil › Mon espace › Compte.
- Danger zone only (no profile fields in this lot):
  - Clear French list of consequences (aligned with backend F33):
    - the account and sign-in are permanently removed;
    - past requests stay in city records but are detached from the person;
    - upcoming appointments are cancelled;
    - notifications are deleted.
  - Danger button « Supprimer mon compte » opens the confirmation dialog (no API call yet).

## Confirmation dialog

Lightweight citizen dialog (glass / tokens), **not** the back-office `Modal`.

| Control | Rule |
|---------|------|
| Password | Required; mapped to API `password` |
| Checkbox | « Je comprends que cette action est définitive » → API `confirm: true` |
| Confirm | Disabled until password non-empty **and** checkbox checked; blocked while pending (`useApiForm`) |
| Cancel / Escape | Close with no side effects |

Wrong password: field error from API (`messageFor` / `fieldErrors`); **session stays open**.

## Data layer

- `useDeleteMyAccount` in `frontend/src/api/me.ts`: `http.delete('/me', { data: { password, confirm: true } })`.
- On success: `signOutCitizen()` + film `authStore.signOut()`, then navigate to `/?compte=supprime` (and `rewindToCockpit` if needed so the film returns to approach).
- Screens never call axios directly.

## Airlock message

When `compte=supprime` is present on `/`:

- Show a `role="status"` banner: « Votre compte a été supprimé. »
- Strip or ignore the query after display so a refresh does not keep a permanent flag unnecessarily (optional: clear on next navigation).

## Security

- Citizen JWT required (`RequireSession` + `authTokenForSpace` on `/ville/*`).
- Server re-checks password and `role === CITIZEN` (staff → 403). Frontend does not offer this page in staff BO.
- Password re-entry is the anti-abuse gate for an open session.

## Non-goals

- Profile edit / `PATCH /api/me` (full PLAN-01 profil)
- Change password / 2FA / passkeys on this page
- Admin delete (F34)
- Backend schema or route changes

## Acceptance

1. Signed-in citizen: hub → Compte → confirm with password + checkbox → account deleted, session cleared, airlock shows the message.
2. Wrong password → error on field, still signed in.
3. Empty password or unchecked box → no API call.
4. Logged out → `RequireSession` sends to airlock.
5. `npm run typecheck` / `npm test` pass in `frontend/`.
