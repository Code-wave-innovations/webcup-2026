# Citizen account deletion (F33) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in citizen delete their own account from Mon espace (`/ville/espace/compte`) with password + explicit confirm, then land on the airlock with a clear status message.

**Architecture:** No backend changes. Add `useDeleteMyAccount` against existing `DELETE /api/me`. Hub card → Compte page (consequences) → citizen glass dialog (password + checkbox) → clear citizen + film sessions → `/?compte=supprime`. Do not import `frontend/src/backoffice/**`.

**Tech Stack:** React 19, React Router 7, TanStack Query, Vitest, CSS Modules, `ConsolePage`, `Field`, `useApiForm`, `GlassPanel`.

**Spec:** `docs/superpowers/specs/2026-10-04-citizen-compte-suppression-design.md`

## Global Constraints

- French UI copy only
- Citizen app must not import `frontend/src/backoffice/**`
- Pages call the API only through `frontend/src/api/*` hooks
- Re-auth gate: password + `confirm: true`; wrong password keeps the session
- No profile edit / password change / 2FA in this plan
- Do not commit unless the user asks

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/api/me.ts` | Add `deleteMyAccount` + `useDeleteMyAccount` |
| `frontend/src/api/me.deleteAccount.test.ts` | Unit test: mutation calls `DELETE /me` with `{ password, confirm: true }` |
| `frontend/src/ui/ConfirmDialog.tsx` | Lightweight accessible dialog (citizen glass), Escape / backdrop close |
| `frontend/src/ui/ConfirmDialog.module.css` | Overlay + panel styles (tokens) |
| `frontend/src/pages/Espace/ComptePage.tsx` | Consequences + open dialog + submit delete + leave |
| `frontend/src/pages/Espace/EspaceHubPage.tsx` | Add Compte card |
| `frontend/src/pages/Espace/Espace.module.css` | Danger zone + hub grid + dialog form tweaks |
| `frontend/src/app/App.tsx` | Route `ville/espace/compte` behind `RequireSession` |
| `frontend/src/pages/AirlockPage/AirlockPage.tsx` | Banner when `compte=supprime` |
| `frontend/src/pages/AirlockPage/AirlockPage.module.css` | Banner look |

---

### Task 1: `useDeleteMyAccount` (TDD)

**Files:**
- Modify: `frontend/src/api/me.ts`
- Test: `frontend/src/api/me.deleteAccount.test.ts`

**Interfaces:**
- Consumes: `http` from `./client`, `useMutation` from TanStack Query
- Produces:
  - `deleteMyAccount(input: { password: string; confirm: true }): Promise<{ deleted: true; message: string }>`
  - `useDeleteMyAccount()` — `useMutation` whose `mutationFn` is `deleteMyAccount`
  - Both call `http.delete('/me', { data: input })` then return `r.data`
- Note: frontend has Vitest only (no `@testing-library/react`) — test the plain `deleteMyAccount` function

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteMock = vi.fn()

vi.mock('./client', () => ({
  http: {
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}))

import { deleteMyAccount } from './me'

beforeEach(() => {
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({ data: { deleted: true, message: 'ok' } })
})

describe('deleteMyAccount', () => {
  it('DELETEs /me with password and confirm: true', async () => {
    await expect(deleteMyAccount({ password: 'NovaTerra2026!', confirm: true })).resolves.toEqual({
      deleted: true,
      message: 'ok',
    })
    expect(deleteMock).toHaveBeenCalledWith('/me', { data: { password: 'NovaTerra2026!', confirm: true } })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npx vitest run src/api/me.deleteAccount.test.ts </dev/null`  
Expected: FAIL (`deleteMyAccount` export missing)

- [ ] **Step 3: Implement**

Append to `frontend/src/api/me.ts`:

```ts
/** F33: citizen deletes own account — password re-entry required. */
export function deleteMyAccount(input: { password: string; confirm: true }) {
  return http.delete<{ deleted: true; message: string }>('/me', { data: input }).then((r) => r.data)
}

export const useDeleteMyAccount = () => useMutation({ mutationFn: deleteMyAccount })
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd frontend && npx vitest run src/api/me.deleteAccount.test.ts </dev/null`  
Expected: PASS

- [ ] **Step 5: Commit** (only if the user asked)

```bash
git add frontend/src/api/me.ts frontend/src/api/me.deleteAccount.test.ts
git commit -m "feat(api): useDeleteMyAccount for F33 DELETE /me"
```

---

### Task 2: `ConfirmDialog` (citizen UI)

**Files:**
- Create: `frontend/src/ui/ConfirmDialog.tsx`
- Create: `frontend/src/ui/ConfirmDialog.module.css`

**Interfaces:**
- Consumes: React, CSS module tokens (`--color-glass`, `--color-line`, `--color-ice`, …)
- Produces:
  - `ConfirmDialog(props: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }): JSX.Element | null`
  - When `open`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → title id
  - Escape and backdrop click call `onClose`
  - Focus first `[data-autofocus]` or first focusable on open; restore focus to previous active element on close

- [ ] **Step 1: Implement dialog + styles** (no separate visual test — smoke via ComptePage later)

`ConfirmDialog.tsx` (pattern: trap Tab inside the panel, same idea as BO Overlay but **do not import back-office**):

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface ConfirmDialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function ConfirmDialog({ open, title, onClose, children, footer }: ConfirmDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}
```

`ConfirmDialog.module.css`: full-viewport fixed backdrop (`rgba` / glass veil), centered panel with cut corners (`clip-path` like other glass UI), padding, gap, ice border. Footer row: flex wrap, gap, justify flex-end.

- [ ] **Step 2: Typecheck the new module**

Run: `cd frontend && npx tsc -b --pretty false 2>&1 | head -40`  
Expected: no errors from `ConfirmDialog`

- [ ] **Step 3: Commit** (only if the user asked)

```bash
git add frontend/src/ui/ConfirmDialog.tsx frontend/src/ui/ConfirmDialog.module.css
git commit -m "feat(ui): citizen ConfirmDialog for irreversible actions"
```

---

### Task 3: `ComptePage` + route

**Files:**
- Create: `frontend/src/pages/Espace/ComptePage.tsx`
- Modify: `frontend/src/pages/Espace/Espace.module.css`
- Modify: `frontend/src/app/App.tsx`

**Interfaces:**
- Consumes: `useDeleteMyAccount`, `ConfirmDialog`, `useApiForm`, `Field`, `ErrorSummary`, `Button`, `GlassPanel`, `ConsolePage`, `signOutCitizen`, `useAuthStore`, `rewindToCockpit`, `useNavigate`
- Produces: default export page component; on success navigates to `/?compte=supprime`

- [ ] **Step 1: Add CSS for danger zone + hub grid**

Append to `Espace.module.css`:

```css
.hubGrid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.dangerZone {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-color: color-mix(in srgb, var(--color-alert) 45%, var(--color-line));
}

.dangerZone h2 {
  color: var(--color-alert);
}

.consequences {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-muted);
}

.dangerButton {
  align-self: flex-start;
  border-color: var(--color-alert);
  color: var(--color-alert);
  background: color-mix(in srgb, var(--color-alert) 12%, transparent);
}

.dangerButton:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-alert) 22%, transparent);
}

.dialogStack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.checkboxRow {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 0.95rem;
}

.checkboxRow input {
  margin-top: 0.25rem;
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Implement `ComptePage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toApiError } from '../../api/errors'
import { useDeleteMyAccount } from '../../api/me'
import { signOutCitizen } from '../../api/session'
import { rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { useApiForm } from '../../hooks/useApiForm'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Espace.module.css'

interface DeleteValues {
  password: string
  confirm: boolean
}

function leaveAfterDeletion() {
  useAuthStore.getState().signOut()
  signOutCitizen()
  rewindToCockpit()
}

/** F33: explain consequences, then delete with password + explicit confirm. */
export default function ComptePage() {
  const navigate = useNavigate()
  const remove = useDeleteMyAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)

  const form = useApiForm<DeleteValues, { deleted: true; message: string }>({
    labels: { password: 'Mot de passe', confirm: 'Confirmation' },
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.password.trim()) errors.password = 'Saisissez votre mot de passe.'
      if (!values.confirm) errors.confirm = 'Cochez la case pour confirmer.'
      return errors
    },
    describeError: (error) =>
      /incorrect/i.test(toApiError(error).message) ? 'Mot de passe incorrect.' : null,
    submit: (values) => remove.mutateAsync({ password: values.password, confirm: true }),
    onSuccess: () => {
      leaveAfterDeletion()
      navigate({ pathname: '/', search: '?compte=supprime' }, { replace: true })
    },
  })

  const close = () => {
    if (form.pending) return
    setOpen(false)
    setPassword('')
    setConfirm(false)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({ password, confirm })
  }

  const canSubmit = password.trim().length > 0 && confirm && !form.pending

  return (
    <ConsolePage
      title="Compte"
      crumbs={[{ label: 'Mon espace', to: '/ville/espace' }]}
      lead="Fermez votre compte citoyen si vous quittez Terra Nova. Cette action est définitive."
    >
      <GlassPanel className={[styles.card, styles.dangerZone].join(' ')}>
        <h2>Supprimer mon compte</h2>
        <p className={text.note}>Avant de continuer, voici ce qui se passe :</p>
        <ul className={styles.consequences}>
          <li>Votre compte et vos moyens de connexion sont effacés définitivement.</li>
          <li>Vos demandes passées restent archivées par la ville, sans être rattachées à votre identité.</li>
          <li>Vos rendez-vous à venir sont annulés.</li>
          <li>Vos notifications sont supprimées.</li>
        </ul>
        <Button className={styles.dangerButton} onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      </GlassPanel>

      <ConfirmDialog
        open={open}
        title="Confirmer la suppression"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={form.pending}>
              Annuler
            </Button>
            <Button
              className={styles.dangerButton}
              type="submit"
              form="delete-account-form"
              disabled={!canSubmit}
            >
              {form.pending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </>
        }
      >
        <form id="delete-account-form" className={styles.dialogStack} noValidate onSubmit={onSubmit}>
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          <p className={text.note}>Pour éviter qu’une session ouverte ne ferme votre compte, saisissez votre mot de passe.</p>
          <Field
            label="Mot de passe"
            htmlFor={form.fieldId('password')}
            required
            error={form.errors.password}
          >
            {(control) => (
              <input
                {...control}
                data-autofocus
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  form.clearError('password')
                }}
              />
            )}
          </Field>
          <div className={styles.checkboxRow}>
            <input
              id={form.fieldId('confirm')}
              type="checkbox"
              checked={confirm}
              aria-invalid={form.errors.confirm ? true : undefined}
              aria-describedby={form.errors.confirm ? `${form.fieldId('confirm')}-error` : undefined}
              onChange={(e) => {
                setConfirm(e.target.checked)
                form.clearError('confirm')
              }}
            />
            <label htmlFor={form.fieldId('confirm')}>
              Je comprends que cette action est définitive
              {form.errors.confirm ? (
                <span id={`${form.fieldId('confirm')}-error`} className={text.error} role="alert">
                  {' '}
                  — {form.errors.confirm}
                </span>
              ) : null}
            </label>
          </div>
        </form>
      </ConfirmDialog>
    </ConsolePage>
  )
}
```

- [ ] **Step 3: Register the route in `App.tsx`**

Next to the other `espace` routes, add:

```tsx
const ComptePage = lazy(() => import('../pages/Espace/ComptePage'))
```

And:

```tsx
<Route
  path="espace/compte"
  element={
    <RequireSession>
      <Suspense fallback={null}>
        <ComptePage />
      </Suspense>
    </RequireSession>
  }
/>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit** (only if the user asked)

```bash
git add frontend/src/pages/Espace/ComptePage.tsx frontend/src/pages/Espace/Espace.module.css frontend/src/app/App.tsx
git commit -m "feat(espace): Compte page with F33 delete confirmation"
```

---

### Task 4: Hub Compte card

**Files:**
- Modify: `frontend/src/pages/Espace/EspaceHubPage.tsx`

**Interfaces:**
- Consumes: existing hub + `ButtonRouteLink`, `styles.hubGrid`
- Produces: second card linking to `/ville/espace/compte`

- [ ] **Step 1: Update hub**

Wrap the existing Mes demandes `GlassPanel` and a new Compte card in `<div className={styles.hubGrid}>`:

```tsx
<div className={styles.hubGrid}>
  <GlassPanel className={styles.card}>
    {/* existing Mes demandes content unchanged */}
  </GlassPanel>
  <GlassPanel className={styles.card}>
    <h2>Compte</h2>
    <p>Fermer votre compte citoyen si vous quittez la ville.</p>
    <div className={styles.cardActions}>
      <ButtonRouteLink to="/ville/espace/compte">Gérer mon compte</ButtonRouteLink>
    </div>
  </GlassPanel>
</div>
```

- [ ] **Step 2: Smoke in browser (manual)** — `/ville/espace` shows two cards; Compte CTA opens `/ville/espace/compte`.

- [ ] **Step 3: Commit** (only if the user asked)

```bash
git add frontend/src/pages/Espace/EspaceHubPage.tsx
git commit -m "feat(espace): Compte card on Mon espace hub"
```

---

### Task 5: Airlock `?compte=supprime` banner

**Files:**
- Modify: `frontend/src/pages/AirlockPage/AirlockPage.tsx`
- Modify: `frontend/src/pages/AirlockPage/AirlockPage.module.css`

**Interfaces:**
- Consumes: `useSearchParams` (or `useLocation` + `URLSearchParams`)
- Produces: status banner « Votre compte a été supprimé. » when `compte=supprime`; remove the param after first paint so a reload does not keep a permanent flag

- [ ] **Step 1: Banner + clear query**

In `AirlockPage`:

```tsx
import { useSearchParams } from 'react-router'
// ...
const [params, setParams] = useSearchParams()
const deleted = params.get('compte') === 'supprime'

useEffect(() => {
  if (!deleted) return
  const next = new URLSearchParams(params)
  next.delete('compte')
  setParams(next, { replace: true })
}, [deleted, params, setParams])
```

Keep a local `const [showDeleted] = useState(deleted)` **initialized once** from the first render so clearing the query does not hide the banner immediately:

```tsx
const [showDeleted] = useState(() => new URLSearchParams(search).get('compte') === 'supprime')
```

Prefer that over the effect clearing race: read `search` from `useLocation()` once into state, then clear the param in an effect without depending on `showDeleted` flipping.

Render above `AccessHologram`:

```tsx
{showDeleted ? (
  <p className={styles.deletedNotice} role="status">
    Votre compte a été supprimé.
  </p>
) : null}
```

CSS:

```css
.deletedNotice {
  margin: 0 auto 16px;
  max-width: 28rem;
  padding: 12px 16px;
  border: 1px solid var(--color-ice);
  background: var(--color-glass);
  color: var(--color-ice-bright);
  text-align: center;
}
```

- [ ] **Step 2: Run frontend tests + typecheck**

Run:

```bash
cd frontend && npm test </dev/null && npm run typecheck
```

Expected: all green (including `me.deleteAccount.test.ts`).

- [ ] **Step 3: Manual acceptance**

1. Sign in as seed citizen → Mon espace → Gérer mon compte → open dialog → wrong password → error, still signed in.  
2. Correct password + checkbox → redirect to `/`, banner visible, no JWT in `nova-auth-citizen`.  
3. Logged out → `/ville/espace/compte` → airlock via `RequireSession`.

- [ ] **Step 4: Commit** (only if the user asked)

```bash
git add frontend/src/pages/AirlockPage/AirlockPage.tsx frontend/src/pages/AirlockPage/AirlockPage.module.css
git commit -m "feat(airlock): show account-deleted status after F33"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Hub Compte card | 4 |
| `/ville/espace/compte` + consequences | 3 |
| Dialog password + checkbox + confirm | 2 + 3 |
| `DELETE /api/me` via hook | 1 |
| Sign-out + `/?compte=supprime` | 3 + 5 |
| Wrong password keeps session | 3 (`describeError`, no sign-out on fail) |
| `RequireSession` | 3 (`App.tsx`) |
| No backend / no profil edit | Global constraints |

No placeholders left. Types aligned: `{ password: string; confirm: true }` in hook and page submit.
