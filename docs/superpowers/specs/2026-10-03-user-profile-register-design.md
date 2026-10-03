# User profile on register — design

**Date:** 2026-10-03  
**Product:** Terra Nova backend.  
**Scope:** Optional profile photo on citizen self-registration. Face recognition stays on the frontend.

## Goals

1. Persist an optional `User.profile` string (stored file name under `/public`).
2. Accept that file on `POST /api/auth/register` via `multipart/form-data` field `profile`.
3. Keep JSON registration working when no file is sent.

## Non-goals

- Backend calls to `face-recognitions` (enroll / identify / verify).
- Face login endpoint.
- Airlock / wizard frontend wiring.
- `PATCH /api/me` profile upload (later lot).

## Data

```prisma
profile String?  // file name in ./public, e.g. profile-….jpg
```

Exposed on every public user payload (`publicUserSelect`).

## API

`POST /api/auth/register`:

- Body fields unchanged: `email`, `password`, `name`, `last_name`, optional `phone`, `address`, `district_id`, `locale`, `is_vulnerable`.
- Optional file `profile` (jpg / jpeg / png / webp / gif), saved with `saveUpload(req, "profile", "profile")`.
- Response unchanged shape: `201 { token, user }` with `user.profile` set when a file was uploaded.

## Decisions

- Face enroll is the frontend’s responsibility against `face-recognitions` directly.
- No `face_identity` column in this lot.
