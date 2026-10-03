# Conditional Claude refine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip Claude refine on `BALANCED`/`ACCURATE` when STT output looks good enough, and open a short realtime circuit-breaker after repeated refine failures, to cut Anthropic spend.

**Architecture:** Pure `shouldRefine()` decision helper in `modules/refiner/`; call it from `RealtimeSession.handleChunk` and `runTranscription` before Claude. Realtime sessions track consecutive refine failures and skip further refine after 3.

**Tech Stack:** Node.js + TypeScript, existing Fastify realtime + pipeline, `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-03-conditional-refine-credits-design.md`

## Global Constraints

- `FAST` never calls Claude.
- Reuse `CONFIDENCE_FALLBACK_THRESHOLD` (default `0.55`); no new env vars in v1.
- Circuit breaker: realtime only, 3 consecutive failures, reset on new session.
- Do not change OpenAI STT provider in this plan (dashboard visibility is a separate track).
- TDD: failing test first for each behavior.
- Only commit when the user asks (skip plan commit steps unless explicitly requested).

---

## File map

| File | Role |
|------|------|
| `speech-to-text/src/modules/refiner/should-refine.ts` | `shouldRefine()` + heuristic helpers |
| `speech-to-text/test/should-refine.test.ts` | Table-driven unit tests |
| `speech-to-text/src/modules/realtime/session.ts` | Gate refine + circuit breaker |
| `speech-to-text/src/modules/pipeline/run-transcription.ts` | Gate refine on upload jobs |
| `speech-to-text/test/realtime.test.ts` | Skip / force-refine / circuit WS cases |
| `speech-to-text/test/pipeline.test.ts` | BALANCED skip path |

---

### Task 1: `shouldRefine` helper

**Files:**
- Create: `speech-to-text/src/modules/refiner/should-refine.ts`
- Test: `speech-to-text/test/should-refine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ShouldRefineReason =
    | "empty"
    | "low_confidence"
    | "high_confidence"
    | "short_clean"
    | "script_mismatch"
    | "noisy_text"
    | "default_ok";

  export interface ShouldRefineInput {
    text: string;
    confidence?: number;
    languageHints?: string[];
    threshold?: number; // default 0.55
  }

  export function shouldRefine(input: ShouldRefineInput): { refine: boolean; reason: ShouldRefineReason };
  ```

- [ ] **Step 1: Write the failing test file**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRefine } from "../src/modules/refiner/should-refine.js";

const cases: Array<{
  name: string;
  input: Parameters<typeof shouldRefine>[0];
  refine: boolean;
  reason: string;
}> = [
  { name: "empty", input: { text: "   " }, refine: false, reason: "empty" },
  {
    name: "low confidence",
    input: { text: "bonjour le monde", confidence: 0.4 },
    refine: true,
    reason: "low_confidence",
  },
  {
    name: "high confidence",
    input: { text: "bonjour le monde", confidence: 0.9 },
    refine: false,
    reason: "high_confidence",
  },
  {
    name: "short clean no confidence",
    input: { text: "bonjour" },
    refine: false,
    reason: "short_clean",
  },
  {
    name: "script mismatch",
    input: { text: "Привет мир это тест", languageHints: ["fr"] },
    refine: true,
    reason: "script_mismatch",
  },
  {
    name: "noisy text",
    input: { text: "aaaaaaa !!!! ##### ..... ....." },
    refine: true,
    reason: "noisy_text",
  },
  {
    name: "default ok longer clean",
    input: {
      text: "bonjour tout le monde comment allez vous aujourd hui",
    },
    refine: false,
    reason: "default_ok",
  },
];

for (const c of cases) {
  test(`shouldRefine: ${c.name}`, () => {
    const out = shouldRefine(c.input);
    assert.equal(out.refine, c.refine);
    assert.equal(out.reason, c.reason);
  });
}
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `cd speech-to-text && node --import tsx --test test/should-refine.test.ts`  
Expected: FAIL cannot find module / `shouldRefine` undefined

- [ ] **Step 3: Implement `should-refine.ts`**

Decision order (must match spec):

1. Trim; if empty → `{ refine: false, reason: "empty" }`
2. If `confidence < threshold` (default 0.55) → `low_confidence`
3. Detect script mismatch vs hints (`fr`/`en`/`mg`/`es`/`de`/`it`/`pt` expect Latin; Cyrillic/CJK/Arabic letters against Latin-only hints → mismatch). If mismatch → `script_mismatch` **even when confidence is high**
4. Else if `confidence >= threshold` → `high_confidence`
5. Word count ≤ 3 and clean (`/^[\p{L}\p{M}\s.,!?'’-]+$/u`) → `short_clean`
6. Noisy: same char run ≥ 6, or non-letter ratio > 0.35, or token repeated ≥ 4 times → `noisy_text`
7. Else → `default_ok`

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd speech-to-text && node --import tsx --test test/should-refine.test.ts`  
Expected: all PASS

- [ ] **Step 5: Commit only if user asked**

---

### Task 2: Wire into realtime session + circuit breaker

**Files:**
- Modify: `speech-to-text/src/modules/realtime/session.ts`
- Modify: `speech-to-text/test/realtime.test.ts`

**Interfaces:**
- Consumes: `shouldRefine` from Task 1; `CONFIDENCE_FALLBACK_THRESHOLD` via `deps.config` (extend `Pick<Config, ...>` to include it) or default `0.55`
- Produces: metrics `realtime.refine_skipped` `{ reason }`, `realtime.refine_circuit_open`; skip Claude when `!decision.refine` or circuit open

**Important:** Existing BALANCED test uses fake STT `confidence: 0.9` + text `"bonjour le monde"` → after gating, refine must **not** run. Update that test to pass `confidence: 0.4` (or noisy text) when asserting refine is called.

- [ ] **Step 1: Update / add failing realtime tests**

1. Change the refine-success BALANCED case to force refine:
   ```ts
   { sttResult: { text: "bonjour le monde", confidence: 0.4, segments: [...] }, refineResult: { ... } }
   ```
2. Add: BALANCED + default high confidence → `refineCalls() === 0`, final text = raw STT.
3. Add: BALANCED + refine always errors; send 3 speech chunks → refine called 3 times; 4th chunk → `refineCalls()` still 3, final = raw.

- [ ] **Step 2: Run targeted tests — expect FAIL on new assertions**

Run: `cd speech-to-text && node --import tsx --test test/realtime.test.ts`  
Expected: new skip/circuit cases FAIL

- [ ] **Step 3: Implement in `session.ts`**

After successful STT, before refine branch:

```ts
const threshold = this.deps.config?.CONFIDENCE_FALLBACK_THRESHOLD ?? 0.55;
const decision = shouldRefine({
  text: sttResult.text,
  confidence: sttResult.confidence,
  languageHints: this.options.languageHints,
  threshold,
});

if (this.options.mode === "FAST" || !decision.refine || this.refineCircuitOpen) {
  if (this.options.mode !== "FAST" && (!decision.refine || this.refineCircuitOpen)) {
    logMetric("realtime.refine_skipped", {
      sessionId: this.id,
      reason: this.refineCircuitOpen ? "circuit_open" : decision.reason,
    });
  }
  // emit partial + final from raw STT (same as FAST path)
  ...
  return [partial, final];
}
```

On refine catch: `this.consecutiveRefineFailures++`; if `>= 3`, set `this.refineCircuitOpen = true` and log `realtime.refine_circuit_open`.  
On refine success: reset `consecutiveRefineFailures = 0`.  
Fields on class: `private consecutiveRefineFailures = 0`, `private refineCircuitOpen = false`.

Extend deps config pick: `"OPENAI_API_KEY" | "ANTHROPIC_API_KEY" | "CONFIDENCE_FALLBACK_THRESHOLD"`.

Ensure `chunkHasSpeech` still allows fake buffers (decode fail → true) so tests keep working.

- [ ] **Step 4: Run realtime tests — expect PASS**

Run: `cd speech-to-text && node --import tsx --test test/realtime.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit only if user asked**

---

### Task 3: Wire into upload pipeline

**Files:**
- Modify: `speech-to-text/src/modules/pipeline/run-transcription.ts` (refine block ~246–292)
- Modify: `speech-to-text/test/pipeline.test.ts`

**Interfaces:**
- Consumes: `shouldRefine`, `config.CONFIDENCE_FALLBACK_THRESHOLD`
- Produces: `logMetric("refine.skipped", { jobId, reason })` when skipping; no `ProviderCall` refine row on skip

- [ ] **Step 1: Add failing pipeline test**

BALANCED job with STT `confidence: 0.95`, clean French text → assert `refine` mock never called, persisted text = raw STT, and provider calls do not include a successful refine (or refine not invoked).

Keep existing BALANCED refine test but set STT `confidence: 0.4` (or omit confidence + use noisy/mismatch text) so refine still runs.

- [ ] **Step 2: Run pipeline tests — expect FAIL**

Run: `cd speech-to-text && node --import tsx --test test/pipeline.test.ts`  
Expected: new skip case FAIL; possibly old BALANCED case FAIL until confidence adjusted

- [ ] **Step 3: Gate refine in `runTranscription`**

```ts
if (job.mode !== "FAST") {
  const decision = shouldRefine({
    text,
    confidence: sttResult.confidence,
    languageHints,
    threshold: config.CONFIDENCE_FALLBACK_THRESHOLD,
  });
  if (!decision.refine) {
    logMetric("refine.skipped", { jobId, reason: decision.reason });
  } else {
    // existing refine try/catch
  }
}
```

- [ ] **Step 4: Run pipeline + should-refine + realtime — expect PASS**

Run: `cd speech-to-text && node --import tsx --test test/should-refine.test.ts test/realtime.test.ts test/pipeline.test.ts`  
Expected: all PASS

- [ ] **Step 5: Commit only if user asked**

---

## Execution handoff

After this plan is saved, implement with **subagent-driven-development** or **executing-plans**, Task 1 → 2 → 3.

**Out of scope (separate brainstorm):** replacing OpenAI gpt-transcribe so usage does not appear on the OpenAI dashboard.
