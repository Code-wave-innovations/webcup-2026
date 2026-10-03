# Nova speak message (`useSpeakMessage`) — design

**Date:** 2026-10-03  
**Product:** Terra Nova frontend (citizen film / NOVA).  
**Scope:** Reusable hook to speak a short message aloud. No city-section wiring, no MMS runtime, no mute UI in this lot.

## Goals

1. Let any screen call `speak(text, locale)` to hear a phrase.
2. **FR / EN** via browser `speechSynthesis` (free, no API key).
3. **MG** via a **pre-generated** audio file URL (offline Meta MMS-TTS `facebook/mms-tts-mlg` outside the app).
4. Single active utterance/audio at a time (`stop` before each `speak`).
5. Respect autoplay policy for MG via an explicit `unlock()` after a user gesture.

## Non-goals

- Installing or shipping MMS / Transformers in the browser.
- npm packages such as `speech-into-text` (STT only; not TTS).
- Per-section phrase catalogue or `useCityScroll` integration.
- Mounting Nova 3D or calling `nova.say` inside the hook (caller may do that).
- Back-office agent/admin surfaces.

## Locale engines

| Locale | Engine | Notes |
|--------|--------|--------|
| `fr` | `SpeechSynthesisUtterance` | Prefer a `fr-*` voice when available; `lang` = `fr-FR` |
| `en` | `SpeechSynthesisUtterance` | Prefer an `en-*` voice; `lang` = `en-US` |
| `mg` | `HTMLAudioElement` | Requires `options.audioUrl`; no browser voice for Malagasy |

## API

`frontend/src/hooks/useSpeakMessage.ts`

- `speak(text, locale, options?)` → stops previous, then speaks; no-op when muted (default) or when `mg` lacks `audioUrl` (dev warning).
- `stop()` → `speechSynthesis.cancel()` + pause/reset current `Audio`.
- `speaking` / `muted` / `setMuted`.
- `unlock()` → silent play once so later MG playback is allowed.
- `supported.speechSynthesis` → whether the Web Speech API exists.

Module-level singleton for the in-flight `Audio` / utterance so overlapping hook instances do not stack speech.

## Future (out of this lot)

- Phrase map per city section × locale + MMS batch script → `public/tts/<section>.mg.wav`.
- Wire `useCityScroll` active index → `speak` + optional `nova.say`.
