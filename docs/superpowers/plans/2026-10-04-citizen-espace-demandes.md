# Citizen Espace + Mes demandes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in citizens a Mon espace hub and Mes demandes list/detail (status + public timeline) reachable from a shared menu on the city flyover and console.

**Architecture:** No backend changes. Reuse `frontend/src/api/requests.ts` hooks against `GET/POST /api/requests`. Add a pure `requestStatus` map, citizen-side relative time helpers, a shared `CitizenNav`, and three console pages under `/ville/espace/*` behind `RequireSession` (JWT in `api/session`). Do not import anything from `frontend/src/backoffice/`.

**Tech Stack:** React 19, React Router 7, TanStack Query, Vitest, CSS Modules, existing `ConsoleLayout` / `ConsolePage` / `Field` / `useApiForm`.

**Spec:** `docs/superpowers/specs/2026-10-04-citizen-espace-demandes-design.md`

## Global Constraints

- French UI copy; never show raw API status codes (`IN_REVIEW`, etc.)
- Status labels and frise steps come only from `frontend/src/api/requestStatus.ts`
- Citizen app must not import `frontend/src/backoffice/**`
- Pages call API only through `frontend/src/api/*` hooks
- `RequireSession` uses JWT (`api/session`); flyover still uses demo `authStore` — Mon espace needs a real login (seed via `/ville/test` DevLogin or airlock once live)
- Do not commit unless the user asks
- No contact / signalement / démarche create forms in this plan

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/api/requestStatus.ts` | Citizen status labels, frise step index, next-step hint, event-type labels |
| `frontend/src/api/requestStatus.test.ts` | Unit tests for the map |
| `frontend/src/lib/format.ts` | Add `formatRelative` / `formatDateTime` (citizen copy of BO helpers) |
| `frontend/src/lib/format.test.ts` | Unit tests for `formatRelative` |
| `frontend/src/lib/useNow.ts` | Ticking `Date.now()` for relative labels (React Compiler–safe) |
| `frontend/src/pages/Console/CitizenNav.tsx` | Shared Accueil + Mon espace links + waiting badge |
| `frontend/src/pages/Console/CitizenNav.module.css` | Badge chip styles |
| `frontend/src/pages/Console/ConsoleTopBar.tsx` | Mount `CitizenNav` |
| `frontend/src/pages/CityPage/CityChrome.tsx` | Add Mon espace link (+ badge) beside section anchors |
| `frontend/src/pages/Espace/EspaceHubPage.tsx` | Hub greeting + Mes demandes card |
| `frontend/src/pages/Espace/DemandesListPage.tsx` | Tabs, search, paginated list |
| `frontend/src/pages/Espace/DemandeDetailPage.tsx` | Frise, history, reply, recap |
| `frontend/src/pages/Espace/RequestFrise.tsx` | Visual step strip for one status |
| `frontend/src/pages/Espace/Espace.module.css` | Layout for hub / list / detail / frise |
| `frontend/src/app/App.tsx` | Register the three routes under `ConsoleLayout` |

---

### Task 1: `requestStatus` map (TDD)

**Files:**
- Create: `frontend/src/api/requestStatus.ts`
- Test: `frontend/src/api/requestStatus.test.ts`

**Interfaces:**
- Produces:
  - `CITIZEN_STATUS_LABEL: Record<RequestStatus, string>`
  - `TYPE_LABEL: Record<RequestType, string>`
  - `EVENT_TYPE_LABEL: Record<RequestEventType, string>`
  - `FRISE_STEPS: readonly ['Reçue', 'En examen', 'En cours', 'Résolue']`
  - `friseIndex(status: RequestStatus): number` — 0..3 active step; `REJECTED` / `CLOSED` / `RESOLVED` → 3
  - `friseTone(status: RequestStatus): 'progress' | 'waiting' | 'done' | 'rejected'`
  - `nextStepHint(status: RequestStatus): string`
  - `isOpenStatus(status: RequestStatus): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  CITIZEN_STATUS_LABEL,
  FRISE_STEPS,
  friseIndex,
  friseTone,
  nextStepHint,
  isOpenStatus,
} from './requestStatus'

describe('requestStatus', () => {
  it('exposes citizen-facing labels without raw codes', () => {
    expect(CITIZEN_STATUS_LABEL.IN_REVIEW).toBe('En examen')
    expect(CITIZEN_STATUS_LABEL.WAITING_CITIZEN).toBe('Votre réponse est attendue')
    expect(FRISE_STEPS).toHaveLength(4)
  })

  it('maps statuses onto the frise', () => {
    expect(friseIndex('SUBMITTED')).toBe(0)
    expect(friseIndex('IN_REVIEW')).toBe(1)
    expect(friseIndex('IN_PROGRESS')).toBe(2)
    expect(friseIndex('WAITING_CITIZEN')).toBe(2)
    expect(friseIndex('RESOLVED')).toBe(3)
    expect(friseIndex('CLOSED')).toBe(3)
    expect(friseIndex('REJECTED')).toBe(3)
    expect(friseTone('WAITING_CITIZEN')).toBe('waiting')
    expect(friseTone('REJECTED')).toBe('rejected')
    expect(friseTone('RESOLVED')).toBe('done')
  })

  it('gives a next-step hint and open/closed', () => {
    expect(nextStepHint('SUBMITTED')).toMatch(/prise en charge/i)
    expect(nextStepHint('WAITING_CITIZEN')).toMatch(/répond/i)
    expect(isOpenStatus('IN_PROGRESS')).toBe(true)
    expect(isOpenStatus('CLOSED')).toBe(false)
    expect(isOpenStatus('REJECTED')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npx vitest run src/api/requestStatus.test.ts </dev/null`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement**

```ts
import type { RequestEventType, RequestStatus, RequestType } from './types'

export const CITIZEN_STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: 'Reçue',
  IN_REVIEW: 'En examen',
  IN_PROGRESS: 'En cours',
  WAITING_CITIZEN: 'Votre réponse est attendue',
  RESOLVED: 'Résolue',
  REJECTED: 'Refusée',
  CLOSED: 'Clôturée',
}

export const TYPE_LABEL: Record<RequestType, string> = {
  CONTACT: 'Message',
  PROCEDURE: 'Démarche',
  INCIDENT: 'Signalement',
}

export const EVENT_TYPE_LABEL: Record<RequestEventType, string> = {
  CREATED: 'Demande reçue',
  STATUS_CHANGED: 'Statut mis à jour',
  ASSIGNED: 'Prise en charge',
  PRIORITY_CHANGED: 'Priorité modifiée',
  COMMENT: 'Message',
}

export const FRISE_STEPS = ['Reçue', 'En examen', 'En cours', 'Résolue'] as const

const INDEX: Record<RequestStatus, number> = {
  SUBMITTED: 0,
  IN_REVIEW: 1,
  IN_PROGRESS: 2,
  WAITING_CITIZEN: 2,
  RESOLVED: 3,
  CLOSED: 3,
  REJECTED: 3,
}

export const friseIndex = (status: RequestStatus) => INDEX[status]

export function friseTone(status: RequestStatus): 'progress' | 'waiting' | 'done' | 'rejected' {
  if (status === 'WAITING_CITIZEN') return 'waiting'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'RESOLVED' || status === 'CLOSED') return 'done'
  return 'progress'
}

export function nextStepHint(status: RequestStatus): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Un agent va prendre en charge votre demande'
    case 'IN_REVIEW':
      return 'Examen en cours par les services'
    case 'IN_PROGRESS':
      return 'Traitement en cours'
    case 'WAITING_CITIZEN':
      return 'Votre réponse est attendue'
    case 'RESOLVED':
      return 'Demande résolue'
    case 'REJECTED':
      return 'Demande refusée'
    case 'CLOSED':
      return 'Demande clôturée'
  }
}

const OPEN: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN']
export const isOpenStatus = (status: RequestStatus) => OPEN.includes(status)
```

Labels for list pills: use `CITIZEN_STATUS_LABEL` as above (`Reçue` not `Envoyée` — matches the frise wording in the spec).

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/api/requestStatus.test.ts </dev/null`

- [ ] **Step 5: Commit only if the user asked**

---

### Task 2: Relative time helpers (TDD)

**Files:**
- Modify: `frontend/src/lib/format.ts`
- Create: `frontend/src/lib/useNow.ts`
- Test: `frontend/src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatRelative(iso: string, now: number): string`, `formatDateTime(iso: string): string`, `useNow(): number`
- Do not import from `backoffice/lib/format`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { formatRelative } from './format'

describe('formatRelative', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z')

  it('formats recent and older past times in French', () => {
    expect(formatRelative('2026-10-04T11:59:30.000Z', now)).toBe('à l’instant')
    expect(formatRelative('2026-10-04T11:48:00.000Z', now)).toBe('il y a 12 min')
    expect(formatRelative('2026-10-04T09:00:00.000Z', now)).toBe('il y a 3 h')
    expect(formatRelative('2026-10-02T12:00:00.000Z', now)).toBe('il y a 2 j')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (export missing)

Run: `cd frontend && npx vitest run src/lib/format.test.ts </dev/null`

- [ ] **Step 3: Append to `lib/format.ts`**

```ts
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

/** "à l’instant", "il y a 12 min", "il y a 3 h", "il y a 2 j". */
export function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const future = diff < 0
  const minutes = Math.round(Math.abs(diff) / 60_000)
  if (minutes < 1) return 'à l’instant'
  let text: string
  if (minutes < 60) text = `${minutes} min`
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} h`
  else text = `${Math.round(minutes / 1440)} j`
  return future ? `dans ${text}` : `il y a ${text}`
}
```

Create `frontend/src/lib/useNow.ts` by copying the body of `frontend/src/backoffice/lib/useNow.ts` (same subscribe/interval pattern).

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 3: Shared `CitizenNav` + menus

**Files:**
- Create: `frontend/src/pages/Console/CitizenNav.tsx`
- Create: `frontend/src/pages/Console/CitizenNav.module.css`
- Modify: `frontend/src/pages/Console/ConsoleTopBar.tsx`
- Modify: `frontend/src/pages/CityPage/CityChrome.tsx`

**Interfaces:**
- Produces: `CitizenNav({ variant: 'console' | 'flyover' })`
- Consumes: `useRequests`, `useSignedIn`, `CITIZEN_STATUS` filters
- Badge: `useRequests({ status: ['WAITING_CITIZEN'], limit: 1 }, signedIn)` → `data?.meta.total`; hide when `!signedIn` or total === 0

- [ ] **Step 1: Implement `CitizenNav`**

```tsx
import { Link, useLocation } from 'react-router'
import { useRequests } from '../../api/requests'
import { useSignedIn } from '../../api/session'
import styles from './CitizenNav.module.css'

const current = (active: boolean) => (active ? 'true' : undefined)

export function CitizenNav({ variant }: { variant: 'console' | 'flyover' }) {
  const { pathname } = useLocation()
  const signedIn = useSignedIn()
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 }, signedIn)
  const count = waiting.data?.meta.total ?? 0
  const onEspace = pathname.startsWith('/ville/espace')

  return (
    <>
      {variant === 'console' && (
        <Link to="/ville" aria-current={current(pathname === '/ville')}>
          Accueil
        </Link>
      )}
      <Link to="/ville/espace" aria-current={current(onEspace)} className={styles.espaceLink}>
        Mon espace
        {count > 0 && (
          <span className={styles.badge} aria-label={`${count} demande(s) à compléter`}>
            {count}
          </span>
        )}
      </Link>
    </>
  )
}
```

CSS: badge as a small ice chip next to the label (`min-width` 1.25rem, tabular nums). Keep links styled by the parent `.links a` rules — `CitizenNav` fragments render as direct children of `<nav className={…links}>`.

- [ ] **Step 2: Wire `ConsoleTopBar`**

Replace the single Accueil link with:

```tsx
<nav className={chrome.links} aria-label="Rubriques">
  <CitizenNav variant="console" />
</nav>
```

Keep brand, account badge, sign-in / sign-out as they are.

- [ ] **Step 3: Wire flyover `TopBar` in `CityChrome.tsx`**

Inside the existing `<nav className={styles.links}>`, after the `CITY_SECTIONS` anchors, render `<CitizenNav variant="flyover" />`. Import `Link` is already not needed if `CitizenNav` owns the link.

- [ ] **Step 4: Manual check**

Run: `cd frontend && npm run typecheck`  
Expected: PASS. In the browser (JWT via `/ville/test` DevLogin as `citoyen@novaterra.local`): console and flyover show « Mon espace »; badge appears if the seed has a `WAITING_CITIZEN` request for that citizen.

---

### Task 4: Routes + Hub `/ville/espace`

**Files:**
- Create: `frontend/src/pages/Espace/EspaceHubPage.tsx`
- Create: `frontend/src/pages/Espace/Espace.module.css`
- Modify: `frontend/src/app/App.tsx`

**Interfaces:**
- Consumes: `RequireSession`, `useSessionUser`, `useRequests`, `ConsolePage`, `GlassPanel`, `ButtonRouteLink`, `messageFor`
- Produces: default export page component

- [ ] **Step 1: Add routes in `App.tsx` inside the `ConsoleLayout` route group** (before the `*` NotFound), lazy-load the pages:

```tsx
const EspaceHubPage = lazy(() => import('../pages/Espace/EspaceHubPage'))
const DemandesListPage = lazy(() => import('../pages/Espace/DemandesListPage'))
const DemandeDetailPage = lazy(() => import('../pages/Espace/DemandeDetailPage'))
```

```tsx
<Route
  path="espace"
  element={
    <RequireSession>
      <Suspense fallback={null}>
        <EspaceHubPage />
      </Suspense>
    </RequireSession>
  }
/>
<Route
  path="espace/demandes"
  element={
    <RequireSession>
      <Suspense fallback={null}>
        <DemandesListPage />
      </Suspense>
    </RequireSession>
  }
/>
<Route
  path="espace/demandes/:id"
  element={
    <RequireSession>
      <Suspense fallback={null}>
        <DemandeDetailPage />
      </Suspense>
    </RequireSession>
  }
/>
```

Import `RequireSession` from `./guards`.

- [ ] **Step 2: Implement hub**

```tsx
// EspaceHubPage.tsx — outline
export default function EspaceHubPage() {
  const user = useSessionUser()
  const open = useRequests({ scope: 'open', limit: 1 })
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })
  const district = user?.district?.name

  return (
    <ConsolePage
      title="Mon espace"
      crumbs={[]}
      lead={
        user
          ? `Bonjour ${user.name}${district ? ` · ${district}` : ''}. Retrouvez ici le suivi de vos démarches.`
          : undefined
      }
    >
      <GlassPanel className={styles.card}>
        <h2>Mes demandes</h2>
        {(open.isPending || waiting.isPending) && <p className={text.note}>Chargement…</p>}
        {open.isError && (
          <p className={text.error}>
            {messageFor(open.error)}{' '}
            <button type="button" onClick={() => void open.refetch()}>Réessayer</button>
          </p>
        )}
        {open.data && waiting.data && (
          <>
            <p>
              {open.data.meta.total} en cours
              {waiting.data.meta.total > 0 ? ` · ${waiting.data.meta.total} à compléter` : ''}
            </p>
            <ButtonRouteLink to="/ville/espace/demandes">Voir mes demandes</ButtonRouteLink>
          </>
        )}
      </GlassPanel>
    </ConsolePage>
  )
}
```

Use `text.module.css` from `ui/` like `ConsoleTestPage`. Style `.card` with a simple stack gap in `Espace.module.css`.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run typecheck`  
Without JWT → redirect airlock. With JWT → hub shows counts from seed.

---

### Task 5: List `/ville/espace/demandes`

**Files:**
- Create: `frontend/src/pages/Espace/DemandesListPage.tsx`
- Modify: `frontend/src/pages/Espace/Espace.module.css`

**Interfaces:**
- Consumes: `useRequests`, `useSearchParams`, `CITIZEN_STATUS_LABEL`, `TYPE_LABEL`, `nextStepHint`, `formatRelative`, `useNow`
- URL params: `onglet` (`en-cours` | `a-completer` | `terminees` | `toutes`), `q`, `page`

- [ ] **Step 1: Tab → filter helper (inline in the page file)**

```ts
type Tab = 'en-cours' | 'a-completer' | 'terminees' | 'toutes'

function filtersFor(tab: Tab, q: string, page: number): RequestFilters {
  const base: RequestFilters = { q: q || undefined, page, limit: 10, sort: 'updated' }
  if (tab === 'en-cours') return { ...base, scope: 'open' }
  if (tab === 'a-completer') return { ...base, status: ['WAITING_CITIZEN'] }
  if (tab === 'terminees') return { ...base, scope: 'closed' }
  return base
}
```

- [ ] **Step 2: Implement the page**

- `ConsolePage` title « Mes demandes », crumbs `[{ label: 'Mon espace', to: '/ville/espace' }]`
- Tablist (`role="tablist"`) of four buttons/links that set `onglet` in the URL and reset `page` to 1
- Search `<input>` bound to `q` (submit or debounce 300 ms via updating search params)
- List: each row is a `Link` to `/ville/espace/demandes/${id}` showing type, subject, reference, status pill (`CITIZEN_STATUS_LABEL`), `formatRelative(updated_at, now)`, `nextStepHint(status)`
- Pagination: prev/next when `meta.pages > 1`
- Empty: « Aucune demande pour ce filtre. » + `ButtonRouteLink` to `/ville`
- Loading / error with `messageFor` + retry

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run typecheck`  
Signed in as seed citizen: « En cours » lists open demo requests; « Terminées » lists closed; search by reference works.

---

### Task 6: Detail `/ville/espace/demandes/:id`

**Files:**
- Create: `frontend/src/pages/Espace/RequestFrise.tsx`
- Create: `frontend/src/pages/Espace/DemandeDetailPage.tsx`
- Modify: `frontend/src/pages/Espace/Espace.module.css`

**Interfaces:**
- Consumes: `useRequest`, `useAddComment`, `useParams`, `requestStatus.*`, `imgUrl`, `useApiForm`, `Field`, `ErrorSummary`
- `RequestFrise({ status: RequestStatus })` reads `FRISE_STEPS`, `friseIndex`, `friseTone`

- [ ] **Step 1: `RequestFrise`**

```tsx
export function RequestFrise({ status }: { status: RequestStatus }) {
  const active = friseIndex(status)
  const tone = friseTone(status)
  return (
    <ol className={styles.frise} data-tone={tone} aria-label="Étapes de la demande">
      {FRISE_STEPS.map((label, i) => (
        <li key={label} data-state={i < active ? 'done' : i === active ? 'current' : 'todo'}>
          <span className={styles.friseDot} aria-hidden="true" />
          <span>{tone === 'rejected' && i === active ? CITIZEN_STATUS_LABEL.REJECTED : label}</span>
        </li>
      ))}
    </ol>
  )
}
```

For `CLOSED`, keep step label « Résolue » on the last node but show status pill « Clôturée » in the header (spec: terminal). For `WAITING_CITIZEN`, `data-tone="waiting"` styles the current step with ice/alert emphasis. CSS: horizontal steps on desktop, wrap on small screens; current step underlined with `--color-ice`.

- [ ] **Step 2: Detail page structure**

```tsx
export default function DemandeDetailPage() {
  const { id: raw } = useParams()
  const id = Number(raw)
  const detail = useRequest(Number.isInteger(id) && id > 0 ? id : undefined)
  // …
}
```

- Invalid id or `detail.isError` with status 404 → reuse console not-found copy (`ConsolePage` « Demande introuvable » + link to list). Use `toApiError(detail.error)?.status === 404`.
- Header: `TYPE_LABEL[type]` · subject · reference + copy button (`navigator.clipboard.writeText`) · status pill
- `<RequestFrise status={request.status} />`
- **History:** `[...request.events].reverse()` (newest first). For each event:
  - title: if `STATUS_CHANGED` and `to_status` → `CITIZEN_STATUS_LABEL[to_status]`; else `EVENT_TYPE_LABEL[type]`
  - who: `author ? `${author.name} ${author.last_name}` : 'Service municipal'`
  - when: `formatRelative` + `formatDateTime`
  - body: `message` when present (comments / refusal note)
- **Reply form** (always available when open; visually emphasize when `WAITING_CITIZEN`):

```ts
const form = useApiForm({
  labels: { message: 'Votre message' },
  submit: (values: { message: string }) =>
    addComment.mutateAsync({ id: request.id, message: values.message, is_internal: false }),
  validate: (values) => {
    const errors: Record<string, string> = {}
    if (!values.message.trim()) errors.message = 'Écrivez un message.'
    return errors
  },
  onSuccess: () => setMessage(''),
})
```

Use `useAddComment()` mutation. Disable while `form.pending`. Hide the form when status is `RESOLVED` | `REJECTED` | `CLOSED`.

- **Recap:** if `location_label` / coords / `attachment` / `data` keys exist, show a `GlassPanel` « Détails ». Attachment: `<a href={`${imgUrl}${attachment}`} …>`.

- [ ] **Step 3: typecheck + lint**

Run:

```bash
cd frontend && npm run typecheck && npm run lint && npm test </dev/null
```

Expected: all PASS.

- [ ] **Step 4: Manual acceptance (seed)**

1. DevLogin `citoyen@novaterra.local` on `/ville/test` (or equivalent JWT path).
2. From `/ville`, open Mon espace → hub counts → Mes demandes.
3. Open a request: frise matches status; no internal events; comment when `WAITING_CITIZEN` appears in history after submit.
4. Agent-only notes stay invisible (compare with an agent view if useful).

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Menu Accueil + Mon espace on console | 3 |
| Mon espace on flyover TopBar | 3 |
| Badge `WAITING_CITIZEN` count | 3 |
| Hub `/ville/espace` | 4 |
| List tabs + search + pagination | 5 |
| Detail frise mapping | 1, 6 |
| Public event history newest-first | 6 |
| Citizen comment | 6 |
| Recap attachment / location / data | 6 |
| `requestStatus.ts` single source | 1 |
| No backoffice imports / no backend changes | global |
| Non-goals (create forms, profil, fake cards) | omitted |

---

## Self-review notes

- Event order fixed to newest-first (matches spec after self-review).
- `CLOSED` keeps frise at step 4 with header pill « Clôturée ».
- Dual session (demo `authStore` vs JWT) documented; pages require JWT.
- No placeholders left in task steps.
