# Conditional Claude refine (credit control) — design

**Date:** 2026-10-03  
**Scope:** Realtime WebSocket sessions + upload pipeline; skip Claude when STT output looks good enough.

## Goals

- Cut Anthropic spend in `BALANCED` / `ACCURATE` without a UI mode switcher.
- Always run primary STT; call Claude refine only when the transcript looks doubtful.
- Log skip/call decisions for tuning.
- Short circuit-breaker after consecutive refine failures in a realtime session (avoid burn on 404/model errors).

## Non-goals

- Hiding OpenAI STT usage from the OpenAI dashboard (impossible with a direct OpenAI API key; needs a different STT provider — tracked separately).
- Changing default realtime UI mode or adding a quality selector.
- Reducing OpenAI STT call frequency (chunk/VAD changes).
- Fixing / swapping the Claude model id (orthogonal; circuit-breaker only limits repeated failures).

## Behavior

| Mode | STT | Claude refine |
|------|-----|---------------|
| `FAST` | always | never |
| `BALANCED` / `ACCURATE` | always | only if `shouldRefine(...)` and circuit is closed |

### `shouldRefine(input)`

Inputs: `text`, optional `confidence`, optional `languageHints`, `threshold` (default `CONFIDENCE_FALLBACK_THRESHOLD` = 0.55).

Decision order:

1. Empty / whitespace-only text → **skip** (`empty`).
2. If `confidence` is a number and `confidence < threshold` → **refine** (`low_confidence`).
3. If `confidence` is a number and `confidence >= threshold` → **skip** (`high_confidence`), unless a strong heuristic below still fires (script mismatch counts as strong).
4. Heuristics (when confidence missing, or as strong override for script mismatch):
   - Word count ≤ 3 and text looks “clean” (letters/spaces/basic punctuation only, no repeated char spam) → **skip** (`short_clean`).
   - Script incompatible with hints (e.g. Cyrillic/CJK when hints are only `fr`/`en`/`mg`) → **refine** (`script_mismatch`).
   - ASR-ish noise: long same-char runs, many non-letter symbols, or obvious repeated token spam → **refine** (`noisy_text`).
   - Else → **skip** (`default_ok`).

Return `{ refine: boolean; reason: string }` for metrics.

### Circuit breaker (realtime only)

- After **3** consecutive `refine` failures in one `RealtimeSession`, set `refineCircuitOpen = true`.
- While open: skip refine for remaining chunks; metric `realtime.refine_circuit_open`.
- Reset on `session.end` / new session (not mid-session).

Upload pipeline: no circuit breaker in v1 (single refine attempt per job already).

## Architecture

- New: `speech-to-text/src/modules/refiner/should-refine.ts` (+ unit tests).
- Wire into:
  - `speech-to-text/src/modules/realtime/session.ts` before calling Claude.
  - `speech-to-text/src/modules/pipeline/run-transcription.ts` when `mode !== FAST`.
- Metrics:
  - `realtime.refine_skipped` / `refine.skipped` with `reason`.
  - existing `realtime.refine_failed` still logged; increment consecutive failure count.

## Config

Reuse `CONFIDENCE_FALLBACK_THRESHOLD` (already in `config.ts`). No new env vars required for v1. Optional later: `REFINE_CIRCUIT_FAILURES` (default 3).

## Tests

- Unit: table-driven cases for empty, low/high confidence, short clean, script mismatch, noisy, default skip.
- Realtime: BALANCED + high-confidence / short-clean STT → `refineCalls === 0`; low confidence → refine once; 3 refine errors → further chunks skip refine.
- Pipeline: BALANCED + skip path persists raw STT text; refine path unchanged when `shouldRefine` true.

## Related (out of scope here)

**OpenAI dashboard visibility:** any call with `OPENAI_API_KEY` to OpenAI Transcriptions appears in that account’s usage UI. To avoid “gpt-transcribe / whisper” lines there, switch primary STT to another stack (self-hosted Whisper, Deepgram, AssemblyAI, Azure Speech, etc.) behind the existing `SttProvider` interface.
