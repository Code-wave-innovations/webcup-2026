# Terra Nova voice: OpenRouter STT + assistant intents — design

**Date:** 2026-10-03  
**Product:** Terra Nova — plateforme numérique centrale de la ville (WebCup).  
**Scope:** Replace OpenAI gpt-transcribe with OpenRouter Whisper Large V3; prepare voice → structured city actions (navigate, inform, report, communicate). Frontend UX evolves later; the voice contract ships first.

## Context

Terra Nova is growing: residents need services, information, communication, and problem reporting. An official Terra Nova API already publishes citizen/Haut Conseil needs. Voice should help residents **act** on the platform (e.g. “va à la page services”, “signale un problème d’eau”), not only dump raw transcript text.

Existing app routes today: `/`, `/face`, `/transcription`. More routes/features will appear as API demands arrive over 24h.

## Goals

1. **Primary STT via OpenRouter** — model `openai/whisper-large-v3` (providers: DeepInfra / Together / Groq → **no OpenAI dashboard usage** for transcription).
2. Strong guidance for **FR / EN / MG** (Malagasy via prompt; Whisper has no strong native MG — Claude refine + languageHints compensate).
3. **Claude for all text quality steps** — (a) conditional transcript refine, (b) Terra Nova voice intents/actions. Whisper never “understands” the city; Claude does.
4. Keep **conditional refine** (`shouldRefine`) so Claude is not called on every clean short utterance (credit control without dropping quality when it matters).
5. Define a **voice action contract**: transcript → `{ action, spokenReply }` so the future Terra Nova UI can navigate / inform / report without rewriting STT.
6. Ship backend (+ thin realtime events) **before** a polished frontend assistant UI.

## Quality stack (locked)

| Step | Engine | Why |
|------|--------|-----|
| Audio → text | OpenRouter `openai/whisper-large-v3` | Cheap STT, no OpenAI dashboard |
| Text polish | **Claude** (Anthropic API) when `shouldRefine` | Best ASR cleanup FR/EN/MG, no translation |
| Intent / actions | **Claude** when `assistant: true` | Reliable structured JSON + city language |
| Skip Claude | empty / high-confidence clean stubs | Save credits |

`ANTHROPIC_API_KEY` remains **required**. Model id via `CLAUDE_REFINER_MODEL` / `CLAUDE_ASSISTANT_MODEL` (default a current Sonnet id; the hard-coded `claude-sonnet-4-20250514` that 404s today must be replaced/configurable).

## Non-goals (v1)

- Full Terra Nova citizen app UI / complete route map.
- Local Whisper hosting.
- Keeping `OPENAI_API_KEY` required for STT (optional leftover only if something else needs it; STT path must not call OpenAI).
- Perfect Malagasy ASR (honest limit of Whisper family).
- Replacing the official Terra Nova needs API — we **consume** demands later; voice intents are the interaction layer.

## Phase A — OpenRouter STT (replace gpt-transcribe)

### Config

| Env | Required | Default |
|-----|----------|---------|
| `OPENROUTER_API_KEY` | **yes** | — |
| `OPENROUTER_STT_MODEL` | no | `openai/whisper-large-v3` |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` |
| `OPENAI_API_KEY` | **no** (remove from required schema) | — |
| `ANTHROPIC_API_KEY` | **yes** | — |
| `CLAUDE_REFINER_MODEL` | no | current Sonnet (env-overridable; fix 404) |
| `CLAUDE_ASSISTANT_MODEL` | no | same as refiner by default |

### Provider

- New: `speech-to-text/src/modules/stt/providers/openrouter-stt.ts`
- `createOpenRouterSttProvider(apiKey, deps?)` implements existing `SttProvider`.
- Call: `POST {base}/audio/transcriptions` with JSON body:
  - `model`: config model
  - `input_audio`: `{ data: base64, format }` derived from file extension (`webm`, `wav`, `mp3`, …)
  - `language`: only OpenAI/Whisper-recognized codes (`fr`, `en`, …) — **never** send `mg` as `language` (reuse `resolveApiLanguage` / prompt-only for MG)
  - `prompt` / language prompt: always bias toward French, English, Malagasy when hints include them
  - `response_format`: `verbose_json` when timestamps wanted; else `json`
- Map response → `SttResult` (text, segments, language, latencyMs) same as today.
- Wire as sole provider in `run-transcription` + `RealtimeSession` (remove live `createGptTranscribeProvider` calls). Keep gpt-transcribe file only if tests still need shared mappers; prefer deleting hot-path usage.

### Language strategy (FR / EN / MG)

| Hint | API `language` | Prompt |
|------|----------------|--------|
| `fr` only | `fr` | “The speech is in French.” |
| `en` only | `en` | English |
| `mg` only | omit | “The speech is in Malagasy.” (+ optional glossary of common MG phrases later) |
| several | omit | “one of: French, English, Malagasy…” |

Refiner (when `shouldRefine`) continues to enforce: do not translate; preserve code-switching; fix ASR using `languageHints`.

## Phase B — Voice assistant actions (Terra Nova)

### Idea

After STT (+ optional Claude refine), run a **Claude** structured-intent step that returns JSON actions the app can execute. Same Anthropic client as the refiner; dedicated system prompt for Terra Nova (navigate only to allowlisted paths; reply in the user’s language FR/EN/MG).

### Action schema (v1)

```ts
type VoiceAction =
  | { type: "navigate"; path: string; label?: string }
  | { type: "inform"; topic: string; query?: string }
  | { type: "report"; category: string; summary: string }
  | { type: "communicate"; channel?: string; draft?: string }
  | { type: "unknown"; reason?: string };

type VoiceAssistantResult = {
  transcript: string;
  languageHints?: string[];
  action: VoiceAction;
  spokenReply: string; // short reply in the user's language
};
```

### Route registry (evolves with the app)

Server-side allowlist of navigable paths + synonyms (FR/EN/MG), e.g.:

| path | synonyms (examples) |
|------|---------------------|
| `/` | accueil, home, trano |
| `/face` | visage, déverrouillage, face unlock |
| `/transcription` | dictée, transcription, voice |

Unknown destinations → `action.type = "unknown"` or `inform` with clarification — **never** invent paths outside the registry (security).

### Realtime events (additive)

Besides `transcript.partial` / `transcript.final`:

- `assistant.action` — `{ action, spokenReply }` after final transcript when assistant mode is on.
- Controlled by `session.start` option: `assistant?: boolean` (default `false` until frontend ready).
- When `assistant: false`, behavior = transcription only (current UX).

### Frontend (later)

- Global mic / Terra Nova assistant shell binds `assistant.action`:
  - `navigate` → `react-router` `navigate(path)`
  - `inform` / `report` / `communicate` → open the matching feature module when built
- Until then: `/transcription` can optionally show JSON action for debugging.

## Phase ordering

1. **A1** OpenRouter STT provider + config + tests; swap pipeline/realtime.
2. **A2** Conditional refine (existing plan `2026-10-03-conditional-refine-credits.md`).
3. **B1** Intent extractor + route registry + `assistant.action` behind flag.
4. **B2** Frontend assistant UI when Terra Nova pages exist.

## Tests

- OpenRouter STT unit: mock fetch; assert URL, Authorization bearer, model, base64 payload, `mg` omits `language`, FR sets `language: "fr"`.
- Realtime/pipeline use OpenRouter fake provider (same harness pattern).
- Intent unit: FR/EN/MG utterances → navigate/inform/report; unknown path rejected.
- Assistant off → no intent LLM call.

## Risks

| Risk | Mitigation |
|------|------------|
| MG ASR weak | Prompt + refine + synonym dictionary for city terms |
| OpenRouter outage | Metrics + clear error; no silent OpenAI fallback (product choice) |
| Intent hallucinates routes | Hard allowlist |
| Cost of Claude | `shouldRefine` gating + `assistant: true` only; skip if transcript empty; circuit-breaker on repeated 404/failures |
| Wrong Claude model id | Env-configurable model; verify against Anthropic before demo |

## Related docs

- Spec refine gating: `docs/superpowers/specs/2026-10-03-conditional-refine-credits-design.md`
- Plan refine: `docs/superpowers/plans/2026-10-03-conditional-refine-credits.md`
- STT package SPEC/PLAN under `speech-to-text/docs/`
