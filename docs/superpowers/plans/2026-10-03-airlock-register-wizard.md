# Airlock Register Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the airlock hologram into a fixed-height, identifier-first wizard: lookup → login (pre-filled) or two-step citizen registration (mock only).

**Architecture:** Pure helpers for identifier validation, mock account lookup, and register-field checks. `AccessHologram` becomes a step shell; each step is a small panel. Login continues to use `useAccessControl` + `demoAuthService`. Registration builds a citizen-shaped `Session` locally and reuses the existing granted / departure path.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-03-airlock-register-wizard-design.md`

## Global Constraints

- Design / mock only — no `POST /api/auth/*`, no new backend lookup endpoint
- No face scan UI, no demo-account buttons in this lot
- Card height stays stable (body min-height; one step visible; no internal scroll)
- Register at airlock: prénom + nom, then password + confirmation only; optional D01 fields deferred to D12
- French copy on the card
- Do not commit unless the user asks
- Preserve hologram chrome (scanlines, corners, ice glow) and granted seal

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/features/auth/accessWizard.ts` | Step union, copy helpers, `normalizeIdentifier`, `validateIdentifier`, `lookupAccount`, register validators, `sessionFromRegister` |
| `frontend/src/features/auth/accessWizard.test.ts` | Unit tests for the pure helpers |
| `frontend/src/features/auth/AccessHologram.tsx` | Shell: step state, header, body swap, granted; remove face/demo UI |
| `frontend/src/features/auth/AccessHologram.module.css` | Fixed body height, step transition, step dots, back link; drop unused face/demo rules only if orphaned |
| `frontend/src/features/auth/panels/IdentifyPanel.tsx` | Identifier field + Continuer |
| `frontend/src/features/auth/panels/LoginPanel.tsx` | Readonly identifier + code + Demander l'entrée + Retour; pips / lock |
| `frontend/src/features/auth/panels/RegisterIdentityPanel.tsx` | Prénom, nom + Suivant + Retour + dots 1/2 |
| `frontend/src/features/auth/panels/RegisterSecretsPanel.tsx` | Password, confirmation + Créer mon accès + Retour + dots 2/2 |

`FaceScan.tsx` / `faceAuth.ts` stay in the repo unused by the hologram for this lot (restore later).

---

### Task 1: Pure wizard helpers (TDD)

**Files:**
- Create: `frontend/src/features/auth/accessWizard.ts`
- Test: `frontend/src/features/auth/accessWizard.test.ts`

**Interfaces:**
```ts
export type AccessStep = 'identify' | 'login' | 'register-1' | 'register-2'

export function normalizeIdentifier(value: string): string
/** Empty → 'empty'; looks like email but invalid → 'email'; else ok */
export function validateIdentifier(value: string): 'ok' | 'empty' | 'email'
/** Known demo account (email or short id) → 'login'; else 'register' (caller already validated) */
export function lookupAccount(identifier: string): 'login' | 'register'
export function validateRegisterNames(name: string, lastName: string): 'ok' | 'missing'
export function validateRegisterSecrets(password: string, confirm: string): 'ok' | 'short' | 'mismatch'
export function sessionFromRegister(identifier: string, name: string): Session
export function stepTitle(step: AccessStep): string
export function stepSubtitle(step: AccessStep): string
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  lookupAccount,
  normalizeIdentifier,
  sessionFromRegister,
  validateIdentifier,
  validateRegisterNames,
  validateRegisterSecrets,
} from './accessWizard'

describe('accessWizard', () => {
  it('normalizes trim + lower case', () => {
    expect(normalizeIdentifier('  Miora@Terra-Nova.City ')).toBe('miora@terra-nova.city')
  })

  it('validateIdentifier', () => {
    expect(validateIdentifier('')).toBe('empty')
    expect(validateIdentifier('not-an-email@')).toBe('email')
    expect(validateIdentifier('miora')).toBe('ok')
    expect(validateIdentifier('new@terra-nova.city')).toBe('ok')
  })

  it('lookupAccount routes demo emails and ids to login', () => {
    expect(lookupAccount('miora@terra-nova.city')).toBe('login')
    expect(lookupAccount('miora')).toBe('login')
    expect(lookupAccount('koto@terra-nova.city')).toBe('login')
    expect(lookupAccount('newbie@terra-nova.city')).toBe('register')
  })

  it('validateRegisterNames and secrets', () => {
    expect(validateRegisterNames('', 'Rakoto')).toBe('missing')
    expect(validateRegisterNames('Miora', 'Rakoto')).toBe('ok')
    expect(validateRegisterSecrets('short', 'short')).toBe('short')
    expect(validateRegisterSecrets('longenough', 'different')).toBe('mismatch')
    expect(validateRegisterSecrets('longenough', 'longenough')).toBe('ok')
  })

  it('sessionFromRegister builds a resident session', () => {
    const session = sessionFromRegister('newbie@terra-nova.city', 'Miora')
    expect(session.name).toBe('Miora')
    expect(session.role).toBe('resident')
    expect(session.roleLabel).toBe('Habitante')
    expect(session.accountId.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/auth/accessWizard.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
// accessWizard.ts — implement against DEMO_ACCOUNTS + isEmail from authService
// validateIdentifier: trim empty → 'empty'; if includes '@' and !isEmail → 'email'; else 'ok'
// lookupAccount: normalize, match DEMO_ACCOUNTS by email or id → 'login', else 'register'
// validateRegisterNames: both trim min 1, max 100
// validateRegisterSecrets: password length >= 8; must equal confirm
// sessionFromRegister: accountId from local part of email or normalized id; role resident / Habitante
// Titles (FR):
//   identify: « Contrôle d'accès de Terra Nova » / « Identifiez-vous pour entrer dans l'atmosphère. »
//   login: same title / « Entrez votre code d'accès. »
//   register-1: « Bienvenue à bord » / « Qui êtes-vous ? »
//   register-2: « Bienvenue à bord » / « Protégez votre accès. »
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/features/auth/accessWizard.test.ts`  
Expected: PASS

---

### Task 2: CSS — fixed body, steps, dots, back

**Files:**
- Modify: `frontend/src/features/auth/AccessHologram.module.css`

**Interfaces:**
- Produces classes: `.body` (min-height), `.panel` / `.panelEnter`, `.dots`, `.dot` / `[data-active]`, `.back`, `.identifierChip`, `.reminder`

- [ ] **Step 1: Add layout rules** (keep existing `.holo`, header, sight, status, submit, granted)

```css
.body {
  position: relative;
  min-height: 220px; /* ~2 fields + actions; tune in browser so login/register match */
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: flex-start;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .panelEnter {
    animation: materialize 0.2s var(--ease-out-soft);
  }
}

.dots {
  display: flex;
  gap: 8px;
  align-items: center;
}

.dots i {
  width: 8px;
  height: 8px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: var(--color-line);
}

.dots i[data-active='true'] {
  background: var(--color-ice);
  filter: drop-shadow(0 0 4px var(--color-ice));
}

.back {
  /* ghost text button under primary; min-height 44px */
}

.identifierChip,
.reminder {
  font-size: 13px;
  color: var(--color-text-muted);
}
```

- [ ] **Step 2: Visually check** that min-height fits register-2 (two password fields + two buttons) without growing the card past identify/login. Adjust `220px` if needed.

---

### Task 3: Step panels

**Files:**
- Create: `frontend/src/features/auth/panels/IdentifyPanel.tsx`
- Create: `frontend/src/features/auth/panels/LoginPanel.tsx`
- Create: `frontend/src/features/auth/panels/RegisterIdentityPanel.tsx`
- Create: `frontend/src/features/auth/panels/RegisterSecretsPanel.tsx`
- Reuse styles from `AccessHologram.module.css` (import parent module or pass `styles`)

**Interfaces:**
```ts
// IdentifyPanel
{
  identifier: string
  error: string | null
  checking: boolean
  onChange: (value: string) => void
  onContinue: () => void
  // optional: identifierRef, cascade styles, activity focus hooks if still used
}

// LoginPanel
{
  identifier: string
  code: string
  access: ReturnType<typeof useAccessControl> // or pick state/secondsLeft/edit handlers
  onCodeChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onBack: () => void
}

// RegisterIdentityPanel
{
  name: string
  lastName: string
  error: string | null
  reminder: string // identifier
  onNameChange / onLastNameChange
  onNext: () => void
  onBack: () => void
}

// RegisterSecretsPanel
{
  password: string
  confirm: string
  error: string | null
  reminder: string
  submitting: boolean
  onPasswordChange / onConfirmChange
  onCreate: () => void
  onBack: () => void
}
```

- [ ] **Step 1: Implement `IdentifyPanel`** — one `Field` « E-mail ou identifiant », primary `Button` « Continuer », inline error from props. No code field, no face, no demos.

- [ ] **Step 2: Implement `LoginPanel`** — show identifier as readonly chip/input; code field with reveal + caps; pips + status text + existing error mapping from `loginMachine`; primary « Demander l'entrée »; secondary/ghost « Retour ». Keep glitch target via `codeSightRef` if parent still animates on strikes (parent can pass ref).

- [ ] **Step 3: Implement `RegisterIdentityPanel`** — dots with first active; fields Prénom / Nom; « Suivant » + « Retour »; show `reminder` (identifier).

- [ ] **Step 4: Implement `RegisterSecretsPanel`** — dots with second active; password + confirmation (reveal toggles ok); « Créer mon accès » + « Retour ».

---

### Task 4: Wire `AccessHologram` shell

**Files:**
- Modify: `frontend/src/features/auth/AccessHologram.tsx`

**Interfaces:**
- Consumes: helpers from Task 1, panels from Task 3, `useAccessControl(demoAuthService, onActivity)`
- Produces: same props API `{ collapsed, onGranted, onActivity?, formRef? }`

- [ ] **Step 1: Replace single-form fields with step state**

```ts
const [step, setStep] = useState<AccessStep>('identify')
const [identifier, setIdentifier] = useState('')
const [code, setCode] = useState('')
const [name, setName] = useState('')
const [lastName, setLastName] = useState('')
const [password, setPassword] = useState('')
const [confirm, setConfirm] = useState('')
const [formError, setFormError] = useState<string | null>(null)
const [lookingUp, setLookingUp] = useState(false)
const [granted, setGranted] = useState<Session | null>(null)
```

- [ ] **Step 2: Header uses `stepTitle(step)` / `stepSubtitle(step)`; on register steps show identifier reminder.**

- [ ] **Step 3: Identify → Continuer**

```ts
const onContinue = async () => {
  const v = validateIdentifier(identifier)
  if (v === 'empty') return setFormError('Saisissez votre e-mail ou identifiant.')
  if (v === 'email') return setFormError('Adresse e-mail invalide.')
  setFormError(null)
  setLookingUp(true)
  await wait(400) // feel only
  setLookingUp(false)
  const route = lookupAccount(identifier)
  setStep(route === 'login' ? 'login' : 'register-1')
}
```

- [ ] **Step 4: Login submit** — keep `access.submit(identifier, code)` → `onGranted` / granted UI. On back → `setStep('identify')` (keep identifier + code). Strikes glitch effect stays.

- [ ] **Step 5: Register-1 Suivant** — `validateRegisterNames`; on ok → `register-2`. Back → `identify`.

- [ ] **Step 6: Register-2 Créer mon accès** — `validateRegisterSecrets`; FR errors (« Le code doit contenir au moins 8 caractères. », « Les codes ne correspondent pas. »); on ok → `sessionFromRegister` → granted → `onGranted(session)`.

- [ ] **Step 7: Remove face mode, FaceScan lazy import, demo fill, face link UI from this component.** Leave `Granted` as today (without faceLink branch, or pass `null`).

- [ ] **Step 8: Form `onSubmit` — preventDefault; dispatch by step (identify continue, login submit, register next/create). Enter key must not skip validation.

- [ ] **Step 9: Manual check in browser** (`cd frontend && npm run dev`)

  - Unknown email → register-1 → register-2 → granted → city departure  
  - `miora@terra-nova.city` → login → TN-2140 → granted  
  - Card does not grow/scroll between steps  
  - Retour keeps filled fields  
  - Bad password / mismatch show inline errors  

---

### Task 5: Smoke existing auth unit tests

**Files:**
- Touch only if imports broke: `loginMachine.test.ts`, `accessLock.test.ts`

- [ ] **Step 1: Run** `cd frontend && npm test -- src/features/auth`  
  Expected: all PASS (including new `accessWizard.test.ts`)

- [ ] **Step 2: Run** `cd frontend && npm run lint` on touched files if the project lint is quick; fix unused imports from removed face/demo code.

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Identifier first | 3, 4 |
| Mock lookup → login or register | 1, 4 |
| Login pre-filled identifier | 3 LoginPanel, 4 |
| Register-1 name/lastName | 1, 3, 4 |
| Register-2 password/confirm | 1, 3, 4 |
| Fixed card height / no scroll | 2, 4 |
| Step dots on register only | 2, 3 |
| No face / no demos | 4 |
| Mock session → onGranted | 1, 4 |
| Optional D01 deferred | (no UI — intentional) |
| Keep lock/pips on login | 3 LoginPanel, 4 |

## Self-review notes

- No TBD placeholders in tasks.
- `AccessStep` / validator names consistent across tasks.
- Face files remain on disk but unwired — matches “out of this lot / restore later”.
