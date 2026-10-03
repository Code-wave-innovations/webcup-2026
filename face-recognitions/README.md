# Face recognition engine

Flask API powered by **InsightFace (SCRFD + ArcFace)**, with multi-sample enrollment, 1:1 verify, 1:N identify, emotion estimation, and passive liveness (heuristic + optional ONNX anti-spoof).

> Software RGB only — not equivalent to iPhone TrueDepth / Secure Enclave.

## Quick start

Requires **Python 3.10–3.11** (not 3.14).

```bash
cd face-recognitions
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# optional emotion (TensorFlow / Keras):
# pip install -r requirements-emotion.txt
cp .env.example .env
python scripts/download_models.py   # buffalo_s ~120MB → ~/.insightface
python api_pro.py
```

Health: `GET http://localhost:9000/health`

Frontend demo: open `http://localhost:5173/face` (set `VITE_FACE_API_URL` in `frontend/.env`).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Engine status + thresholds |
| GET | `/identities` | List enrolled names |
| POST | `/enroll` | Multipart `name` + `img` (or `img0..`) — needs ≥3 samples |
| POST | `/identify` | 1:N match |
| POST | `/verify` | 1:1 — form `name` + `img` (+ liveness) |
| POST | `/emotion` | Emotion label on largest face |
| DELETE | `/identities/<name>` | Remove identity |

Legacy aliases: `POST /create-dataset`, `POST /recognize`, `DELETE /delete-dataset`.

When `FACE_API_KEY` is set, send header `X-API-Key`.

### Example enroll (3 frames)

```bash
curl -X POST http://localhost:9000/enroll \
  -H "X-API-Key: $FACE_API_KEY" \
  -F name=alice \
  -F img0=@a1.jpg -F img1=@a2.jpg -F img2=@a3.jpg
```

## Liveness / anti-spoof

Default: RGB heuristics (demo-grade). For stronger passive spoof detection, place MiniFASNet / Silent-Face-Anti-Spoofing `.onnx` files in `models/anti_spoof/`.

## Docker

```bash
docker build -t face-engine .
docker run --rm -p 9000:9000 -e FACE_API_KEY=secret face-engine
```

## Calibrated thresholds (starting points)

Documented defaults for `buffalo_s` on webcam RGB:

| Mode | Env | Default | Notes |
|------|-----|---------|-------|
| Verify 1:1 | `FACE_VERIFY_THRESHOLD` | 0.45 | Cosine on normed ArcFace |
| Identify 1:N | `FACE_IDENTIFY_THRESHOLD` | 0.40 | Slightly looser; tune on your set |
| Liveness | `FACE_LIVENESS_THRESHOLD` | 0.55 | Heuristic/ONNX blend |

Measure TP/FP on a small held-out set before production use.
