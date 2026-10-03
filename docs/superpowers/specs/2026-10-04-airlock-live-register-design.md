# Airlock live register (face then backend) — design

**Date:** 2026-10-04  
**Product:** Terra Nova citizen airlock + `face-recognitions` + Express auth.  
**Scope:** Dynamise registration: enroll face first (optional skip), then `POST /api/auth/register`. Wire login to the real API for non-demo accounts.

## Flow (register-3)

1. Capture ≥3 camera frames (quality via face engine on enroll).
2. `POST {FACE}/enroll` with `name = faceIdentityFromEmail(email)` and `img0..`.
3. If `committed: true` → `POST /api/auth/register` → session → granted / departure.
4. If user **skips** face → register backend only (no enroll).
5. If enroll fails → error + retry; **no** backend register.
6. If enroll ok but register fails → show error; identity may already exist in the gallery (retry register without re-enroll when frames already committed this session).

## Face identity

- Logical key: normalised e-mail.
- Gallery name: `@` → `.at.` so it matches `sanitize_identity_name` (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`).
- Example: `miora@terra-nova.city` → `miora.at.terra-nova.city`.

## Backend register body

`email`, `password`, `name`, `last_name` (CITIZEN). Token + user → frontend `Session` (`CITIZEN` → `resident`).

## Login

`POST /api/auth/login` for real accounts. Demo accounts (`DEMO_ACCOUNTS`) may remain as local fallback on the identify/login path.

## Non-goals

- Backend proxy that fans out to face.
- Deleting orphan gallery identities.
- City onboarding D12.
- Changing face-recognitions server code (encode on the client only).
