# Airlock access card — identifier-first register wizard (design)

**Date:** 2026-10-03  
**Product:** Terra Nova frontend (citizen film / airlock hologram).  
**Scope:** Redesign the access hologram as a fixed-height multi-step wizard (identifier → login **or** two-step registration). UI / mock only. No real auth API, no face login, no demo-account buttons in this lot.

## Goals

1. Ask only for **e-mail or identifier** first.
2. After a mock lookup: if the account exists → **login** with identifier pre-filled; if not → **citizen registration** in two short steps.
3. Keep the hologram card at a **stable height** (no growth, no internal scroll): one step visible at a time, « Suivant » / « Continuer » / « Retour ».
4. Registration at the airlock stays light: **name + last name**, then **password + confirmation**. Optional D01 fields (phone, address, district, locale, vulnerable) are deferred to **D12 onboarding** after entry (out of this lot).
5. Preserve the existing hologram look (scanlines, corners, ice glow) and the granted seal / departure hand-off.

## Non-goals

- Wiring `POST /api/auth/register` or `POST /api/auth/login`.
- New backend « email exists » endpoint (mock lookup only).
- Face scan / face link.
- Demo account autofill buttons.
- Onboarding D12 UI in the city.
- Staff-only registration (self-register remains CITIZEN-shaped when API is wired later).

## Flow

```
identify ──(mock lookup)──► login ──► granted ──► departure
                 │
                 └──► register-1 ──► register-2 ──► granted ──► departure
```

| Step | Fields / actions | Primary CTA | Back |
|------|------------------|-------------|------|
| `identify` | e-mail or identifier | Continuer | — |
| `login` | identifier pre-filled (readonly) + access code | Demander l'entrée | → `identify` |
| `register-1` | prénom, nom · step dots 1/2 | Suivant | → `identify` |
| `register-2` | mot de passe, confirmation · step dots 2/2 | Créer mon accès | → `register-1` |
| `granted` | existing seal / welcome | (auto) | — |

- Header title / subtitle change per step (e.g. « Qui êtes-vous ? » then « Protégez votre accès »). Identifier shown as a small reminder under the title on register steps.
- Returning from a later step **keeps** already-entered field values.
- Login keeps today’s attempt pips, lockout, glitch-on-refuse behaviour.

## Mock lookup

- Known demo emails (e.g. `miora@terra-nova.city`, `koto@terra-nova.city`) → `login`.
- Any other valid e-mail / short identifier → `register-1`.
- Invalid empty / malformed identifier → inline error on `identify`, stay on step.
- Artificial short « Vérification… » state allowed for feel; no network.

## UI (fixed card)

- Same hologram shell (`AccessHologram` chrome).
- Body region with a **min-height** sized for ~2 fields + primary/secondary actions so steps swap without resizing the card.
- Cross-fade or short horizontal slide (~200 ms); disabled under `prefers-reduced-motion`.
- Register-only step indicator: two ice dots / labels `1 · 2`.
- No face button, no demo account row in this lot (can return in a later design).

## Structure (frontend)

- `AccessHologram` becomes a step shell (status, corners, scan, granted).
- Panels: identify / login / register-1 / register-2 (co-located or small sibling components under `features/auth/`).
- Local state: `step`, `identifier`, register fields, plus existing `useAccessControl` for the login panel only.
- Mock register success builds a citizen-shaped `Session` and calls the same `onGranted` path as login.

## Validation / errors

| Context | Rule |
|---------|------|
| Identify | non-empty; e-mail format when it looks like an e-mail (reuse `isEmail` where applicable) |
| Login | existing missing / refused / locked copy |
| Register-1 | prénom and nom required (trim, max length aligned with D01) |
| Register-2 | password min 8 chars; confirmation must match |

## Future (out of this lot)

- Real `lookup` / register / login against the Express API.
- Restore face entry and demo autofill on `identify` / `login` only.
- City onboarding for phone, address, district (D12).
