# Threshold calibration notes

Starting points for `buffalo_s` (ArcFace cosine on L2-normalized embeddings):

| Parameter | Default | Role |
|-----------|---------|------|
| `FACE_VERIFY_THRESHOLD` | 0.45 | 1:1 unlock — higher = fewer false accepts |
| `FACE_IDENTIFY_THRESHOLD` | 0.40 | 1:N gallery — slightly looser than verify |
| `FACE_LIVENESS_THRESHOLD` | 0.55 | Passive / ONNX blend |

## How to calibrate

1. Enroll 5–10 people with 3 frames each (varied lighting).
2. Collect genuine probes (same people) and impostor probes.
3. Sweep threshold 0.30–0.60; pick operating point for target FAR (e.g. <1%).
4. Re-test with print/screen spoofs if liveness is required.

These are **not** Face ID certified rates.
