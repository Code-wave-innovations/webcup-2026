# Airlock Register District Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On airlock `register-1`, require a district `<select>` defaulting to the first `GET /api/districts` row, and send `district_id` with citizen registration.

**Architecture:** Pure validation in `accessWizard.ts`; `AccessHologram` owns `districtId` + `useDistricts()`; `RegisterIdentityPanel` renders the select; `registerCitizen` posts `district_id`. No backend changes.

**Tech Stack:** React 19, TanStack Query (`useDistricts`), Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-10-04-airlock-register-district-design.md`

## Global Constraints

- District required on the client; default = first list item
- Stay on three register steps (no new step)
- Native `<select>` in `Field`; French copy
- Do not commit unless the user asks
- Backend register schema stays optional for `district_id`

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/features/auth/accessWizard.ts` | `validateRegisterIdentity(name, lastName, districtId)` |
| `frontend/src/features/auth/accessWizard.test.ts` | Unit tests for district validation |
| `frontend/src/features/auth/authService.ts` | `RegisterInput.district_id` + POST body |
| `frontend/src/features/auth/panels/RegisterIdentityPanel.tsx` | Quartier select UI |
| `frontend/src/features/auth/AccessHologram.tsx` | State, default effect, wire panel + register |
| `frontend/src/features/auth/AccessHologram.module.css` | Body `min-height` for three fields |

---

### Task 1: Validation helper (TDD)

**Files:**
- Modify: `frontend/src/features/auth/accessWizard.ts`
- Test: `frontend/src/features/auth/accessWizard.test.ts`

**Interfaces:**
- Produces: `validateRegisterIdentity(name: string, lastName: string, districtId: number | null): 'ok' | 'missing' | 'district'`
- Keeps: `validateRegisterNames` unchanged (still used / reused inside)

- [x] **Step 1: Write the failing test**

```ts
it('validateRegisterIdentity requires names and district', () => {
  expect(validateRegisterIdentity('Miora', 'Rakoto', null)).toBe('district')
  expect(validateRegisterIdentity('Miora', 'Rakoto', 0)).toBe('district')
  expect(validateRegisterIdentity('', 'Rakoto', 1)).toBe('missing')
  expect(validateRegisterIdentity('Miora', 'Rakoto', 1)).toBe('ok')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/auth/accessWizard.test.ts`  
Expected: FAIL (export missing)

- [ ] **Step 3: Implement**

```ts
export function validateRegisterIdentity(
  name: string,
  lastName: string,
  districtId: number | null,
): 'ok' | 'missing' | 'district' {
  if (validateRegisterNames(name, lastName) === 'missing') return 'missing'
  if (districtId == null || !Number.isInteger(districtId) || districtId < 1) return 'district'
  return 'ok'
}
```

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 2: `registerCitizen` payload

**Files:**
- Modify: `frontend/src/features/auth/authService.ts`

**Interfaces:**
- Produces: `RegisterInput { email, password, name, last_name, district_id: number }`

- [ ] **Step 1: Add `district_id` to input and POST body**

```ts
export interface RegisterInput {
  email: string
  password: string
  name: string
  last_name: string
  district_id: number
}

// in registerCitizen:
await authHttp.post<AuthResponse>('/auth/register', {
  email: input.email.trim().toLowerCase(),
  password: input.password,
  name: input.name.trim(),
  last_name: input.last_name.trim(),
  district_id: input.district_id,
})
```

- [ ] **Step 2: `npm run typecheck` in `frontend/` — fix any call sites**

---

### Task 3: Panel + hologram wiring

**Files:**
- Modify: `frontend/src/features/auth/panels/RegisterIdentityPanel.tsx`
- Modify: `frontend/src/features/auth/AccessHologram.tsx`
- Modify: `frontend/src/features/auth/AccessHologram.module.css`

**Interfaces:**
- Consumes: `useDistricts`, `validateRegisterIdentity`, `RegisterInput.district_id`
- Panel props: `districts: District[]`, `districtId: number | null`, `districtsLoading: boolean`, `districtsFailed: boolean`, `onDistrictChange: (id: number) => void`

- [ ] **Step 1: Extend `RegisterIdentityPanel`**

After the nom field, add:

```tsx
<Field label="Quartier" htmlFor="access-district" error={districtsFailed ? 'Impossible de charger les quartiers.' : undefined}>
  <select
    id="access-district"
    name="district_id"
    disabled={districtsLoading || districts.length === 0}
    value={districtId ?? ''}
    onChange={(e) => onDistrictChange(Number(e.target.value))}
  >
    {districtsLoading && <option value="">Chargement…</option>}
    {!districtsLoading && districts.length === 0 && <option value="">Aucun quartier</option>}
    {districts.map((d) => (
      <option key={d.id} value={d.id}>{d.name}</option>
    ))}
  </select>
</Field>
```

- [ ] **Step 2: Wire `AccessHologram`**

```tsx
const { data: districts = [], isLoading: districtsLoading, isError: districtsFailed } = useDistricts()
const [districtId, setDistrictId] = useState<number | null>(null)

useEffect(() => {
  if (districtId == null && districts[0]) setDistrictId(districts[0].id)
}, [districts, districtId])

const onRegisterNext = () => {
  const v = validateRegisterIdentity(name, lastName, districtId)
  if (v === 'missing') return setFormError('Indiquez votre prénom et votre nom.')
  if (v === 'district') return setFormError('Impossible de charger les quartiers.')
  setFormError(null)
  setStep('register-2')
}

// registerOnBackend:
await registerCitizen({
  email: resolveAuthEmail(identifier),
  password,
  name,
  last_name: lastName,
  district_id: districtId!,
})
```

Pass district props into `RegisterIdentityPanel`. Guard `registerOnBackend` if `districtId == null` (should not happen after step validation).

- [ ] **Step 3: CSS** — `.body` `min-height: 236px` → `284px`; mobile `200px` → `248px` if present.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run src/features/auth/accessWizard.test.ts && npm run typecheck`  
Expected: PASS

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Select on register-1 | 3 |
| Default first district | 3 (`useEffect`) |
| Required client-side | 1 + 3 |
| POST `district_id` | 2 + 3 |
| Error copy / loading | 3 |
| Body min-height | 3 |
| Vitest | 1 |
| No backend change | — |
