# Terra Nova OpenRouter STT (A1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenAI gpt-transcribe with OpenRouter `openai/whisper-large-v3` as the sole primary STT for upload pipeline and realtime.

**Architecture:** New `SttProvider` posts base64 audio to OpenRouter `/audio/transcriptions`. Shared language hint helpers (`resolveApiLanguage`, `buildLanguagePrompt`) live in `modules/stt/language.ts`. Config requires `OPENROUTER_API_KEY`; `OPENAI_API_KEY` becomes optional.

**Tech Stack:** Node.js TypeScript, `fetch`, existing `SttProvider` interface, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-03-terra-nova-openrouter-voice-design.md`

## Global Constraints

- Model default: `openai/whisper-large-v3`
- Never send `language: "mg"` — prompt only (reuse allowlist)
- No silent fallback to OpenAI Transcriptions
- Do not commit unless user asks
- Follow-on: A2 conditional refine plan; B1 Claude assistant intents (separate plan after A1+A2)

---

## File map

| File | Role |
|------|------|
| `src/modules/stt/language.ts` | Shared `resolveApiLanguage`, `buildLanguagePrompt`, names |
| `src/modules/stt/providers/openrouter-stt.ts` | OpenRouter STT provider |
| `test/openrouter-stt.mock.test.ts` | Unit tests with mocked fetch |
| `src/config.ts` + `.env.example` | OPENROUTER required; OPENAI optional |
| `src/modules/pipeline/run-transcription.ts` | Default provider → OpenRouter |
| `src/modules/realtime/session.ts` | Default provider → OpenRouter |
| `src/routes/realtime-ws.ts` | Pass OpenRouter key in session config |
| `src/modules/stt/providers/gpt-transcribe.ts` | Re-export language helpers or thin wrapper; keep tests until migrated |
| All `test/*.ts` ensureTestEnv | Set `OPENROUTER_API_KEY` |

---

### Task 1: Shared language helpers

**Files:**
- Create: `speech-to-text/src/modules/stt/language.ts`
- Modify: `speech-to-text/src/modules/stt/providers/gpt-transcribe.ts` (import from language.ts)
- Test: move/keep mg omit coverage via openrouter tests in Task 2; existing gpt tests still pass

- [ ] **Step 1:** Move `LANGUAGE_NAMES`, `OPENAI_LANGUAGE_PARAM_CODES`, `resolveApiLanguage`, `buildLanguagePrompt`, `languageName` into `language.ts`; export them.
- [ ] **Step 2:** Update `gpt-transcribe.ts` to import from `./language.js` (or `../language.js`).
- [ ] **Step 3:** Run `node --import tsx --test test/gpt-transcribe.mock.test.ts` — expect PASS.

---

### Task 2: OpenRouter STT provider (TDD)

**Files:**
- Create: `speech-to-text/src/modules/stt/providers/openrouter-stt.ts`
- Test: `speech-to-text/test/openrouter-stt.mock.test.ts`

**Interfaces:**
```ts
export const OPENROUTER_STT_PROVIDER_NAME = "openrouter-stt";
export const DEFAULT_OPENROUTER_STT_MODEL = "openai/whisper-large-v3";

export function createOpenRouterSttProvider(
  apiKey: string,
  deps?: {
    fetch?: typeof fetch;
    readFile?: (path: string) => Promise<Buffer>;
    baseUrl?: string;
    model?: string;
  },
): SttProvider;
```

- [ ] **Step 1: Write failing tests** — mock `fetch` + `readFile`; assert:
  - POST `{baseUrl}/audio/transcriptions`
  - `Authorization: Bearer …`
  - body.model === `openai/whisper-large-v3`
  - body.input_audio.data base64, format from extension
  - `languageHints: ["fr"]` → body.language === `"fr"`
  - `languageHints: ["mg"]` → no language field; prompt matches /Malagasy/
  - maps `{ text }` → SttResult
  - rejects `.pcm` paths

- [ ] **Step 2: Run test — FAIL**
- [ ] **Step 3: Implement provider**
- [ ] **Step 4: Run test — PASS**

---

### Task 3: Config + wire hot path

**Files:**
- Modify: `config.ts`, `.env.example`, `run-transcription.ts`, `session.ts`, `realtime-ws.ts`, tests’ `ensureTestEnv`, `pipeline.test.ts` fake config

- [ ] **Step 1:** `OPENROUTER_API_KEY` required; `OPENAI_API_KEY` optional; add `OPENROUTER_STT_MODEL`, `OPENROUTER_BASE_URL` defaults.
- [ ] **Step 2:** Default STT = `createOpenRouterSttProvider(config.OPENROUTER_API_KEY, { model, baseUrl })`.
- [ ] **Step 3:** Update all tests to set `OPENROUTER_API_KEY`; fix config objects.
- [ ] **Step 4:** Run `node --import tsx --test test/*.test.ts` — expect PASS (or fix breakages).
- [ ] **Step 5:** Remind user to set `OPENROUTER_API_KEY` in `.env` and restart `npm run dev`.

---

## After A1

1. Execute `docs/superpowers/plans/2026-10-03-conditional-refine-credits.md` (A2).
2. Write + execute B1 plan (Claude assistant intents) from the Terra Nova voice spec.
3. Fix Claude model env (`CLAUDE_REFINER_MODEL`) when touching refiner.
