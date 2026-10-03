# Face recognition engine — design

**Date:** 2026-10-03  
**Scope:** Auth 1:1, identify 1:N, emotion, WebCup demo UX (RGB software only).

## Goals

- Replace brittle dlib/`face_recognition` loop with InsightFace SCRFD + ArcFace.
- Multi-sample enrollment with quality gates.
- Uniform JSON API, sanitize inputs, rate-limit, optional API key.
- Passive liveness for verify (heuristic + optional ONNX).
- Frontend guided webcam flow (oval overlay).

## Non-goals

- Parity with iPhone TrueDepth / Secure Enclave.
- Bank-grade presentation-attack detection without dedicated models/hardware.

## Architecture

- `app/pipeline.py` — detect + embed (+ emotion/liveness hooks)
- `app/store.py` — in-memory cosine gallery, `.npy` persistence
- `app/routes.py` — `/enroll`, `/verify`, `/identify`, `/emotion`, `/health`
- `app/security.py` — name sanitize, API key, upload read
- Frontend `FaceUnlock` at `/face` — enroll / verify / identify / emotion

## Data

```
data/identities/{name}/samples/*.jpg
data/embeddings/{name}.npy
```

Embeddings are L2-normalized; identify/verify use cosine (dot product).

## Thresholds

See `.env.example` — verify 0.45, identify 0.40, liveness 0.55 (starting points).
