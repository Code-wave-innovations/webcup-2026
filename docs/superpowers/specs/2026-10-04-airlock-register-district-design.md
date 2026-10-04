# Airlock registration — required district select (design)

**Date:** 2026-10-04  
**Product:** Terra Nova frontend (citizen airlock hologram).  
**Scope:** Add a required district (`quartier`) choice on registration step 1, defaulting to the first district from the public API, and send `district_id` with `POST /api/auth/register`.

## Goals

1. Every new citizen picks a Terra Nova district during airlock registration.
2. Default selection is the **first** district returned by `GET /api/districts` (server order: `name` asc).
3. Keep the existing three-step register flow (identity → secrets → face); do not add a fourth step.
4. Reuse existing API contracts (`useDistricts`, optional `district_id` on register).

## Non-goals

- Backend schema or auth-controller changes (register already accepts `district_id`).
- Phone, address, locale, or `is_vulnerable` on the airlock form.
- Custom chip / combobox UI — native `<select>` only.
- Back-office district management UX.
- Making `district_id` required in the Prisma schema or zod register schema (client always sends it; server stays optional for other clients).

## Flow

```
identify → register-1 (prénom, nom, quartier) → register-2 → register-3 → POST /auth/register
```

| Step | District behaviour |
|------|--------------------|
| `register-1` | `<select>` under name fields; load via `useDistricts`; auto-select `districts[0].id` when list arrives and no prior choice |
| Later steps | Keep `districtId` in hologram state; back to `register-1` preserves selection |
| Submit | `registerCitizen({ …, district_id })` |

## UI

- Panel: `RegisterIdentityPanel` — label **Quartier**, options show `district.name`.
- While loading: select disabled, placeholder « Chargement… ».
- On list error or empty list: short French error; primary CTA cannot advance.
- Slightly increase hologram `.body` `min-height` so three fields + actions fit without internal scroll (~+48px).
- Style via existing `Field` / `Field.module.css` select rules; hologram chrome unchanged.

## Data & validation

- State: `districtId: number | null` in `AccessHologram`.
- Default effect: when `districts` loads and `districtId` is null, set to `districts[0].id`.
- Advance from `register-1` requires valid names **and** a positive `districtId`.
- Helper: extend register identity validation (names + `districtId`) in `accessWizard.ts`; cover with Vitest.
- `RegisterInput` gains required `district_id: number`; `registerCitizen` posts it in the JSON body.

## Errors

| Case | Copy / behaviour |
|------|------------------|
| Missing name/last name | Existing: « Indiquez votre prénom et votre nom. » |
| No district (empty / failed load) | « Impossible de charger les quartiers. » — stay on `register-1` |
| Register API failure | Existing register error handling |

## Files

| File | Change |
|------|--------|
| `frontend/src/features/auth/panels/RegisterIdentityPanel.tsx` | District select + props |
| `frontend/src/features/auth/AccessHologram.tsx` | `useDistricts`, state, validation, pass `district_id` |
| `frontend/src/features/auth/authService.ts` | `RegisterInput.district_id` |
| `frontend/src/features/auth/accessWizard.ts` (+ test) | Identity validation including district |
| `frontend/src/features/auth/AccessHologram.module.css` | Body min-height tweak |

## Testing

- Unit: validation helper rejects missing district; accepts valid id with names.
- Manual: open airlock register → first district selected → change district → complete register → user has that `district_id` in API/DB.
