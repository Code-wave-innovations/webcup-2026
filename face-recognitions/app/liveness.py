from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.config import ANTI_SPOOF_DIR, LIVENESS_THRESHOLD


class LivenessChecker:
    """
    Passive liveness: optional ONNX MiniFAS-style models + RGB heuristics.
    Without ONNX weights, heuristic score is used (demo-grade, not bank-grade).
    """

    def __init__(self) -> None:
        self._sessions: list = []
        self._load_onnx_models()

    def _load_onnx_models(self) -> None:
        try:
            import onnxruntime as ort
        except ImportError:
            return
        for path in sorted(ANTI_SPOOF_DIR.glob("*.onnx")):
            try:
                self._sessions.append(
                    ort.InferenceSession(
                        str(path), providers=["CPUExecutionProvider"]
                    )
                )
            except Exception:
                continue

    @property
    def backend(self) -> str:
        if self._sessions:
            return "onnx+heuristic"
        return "heuristic"

    def score(self, image_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> dict:
        x1, y1, x2, y2 = bbox
        h, w = image_bgr.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        face = image_bgr[y1:y2, x1:x2]
        if face.size == 0:
            return {
                "ok": False,
                "score": 0.0,
                "threshold": LIVENESS_THRESHOLD,
                "backend": self.backend,
                "reason": "empty_crop",
            }

        heuristic = self._heuristic_score(image_bgr, face)
        onnx_score = self._onnx_score(face) if self._sessions else None

        if onnx_score is not None:
            # Blend: trust ONNX more when available
            final = 0.7 * onnx_score + 0.3 * heuristic
        else:
            final = heuristic

        return {
            "ok": final >= LIVENESS_THRESHOLD,
            "score": round(float(final), 4),
            "threshold": LIVENESS_THRESHOLD,
            "backend": self.backend,
            "heuristic": round(float(heuristic), 4),
            "onnx": None if onnx_score is None else round(float(onnx_score), 4),
        }

    def _heuristic_score(self, full: np.ndarray, face: np.ndarray) -> float:
        """
        Soft signals against flat prints / dull screen replays.
        Not a substitute for TrueDepth.
        """
        gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        lap = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        # Healthy faces usually have mid-high texture; prints/screens often softer or moiré
        texture = _clamp((lap - 20.0) / 180.0)

        hsv = cv2.cvtColor(face, cv2.COLOR_BGR2HSV)
        sat = float(np.mean(hsv[:, :, 1])) / 255.0
        # Very low saturation → grayscale print; extreme → oversaturated display
        sat_score = 1.0 - abs(sat - 0.35) / 0.65
        sat_score = _clamp(sat_score)

        # Local contrast
        contrast = float(gray.std()) / 64.0
        contrast = _clamp(contrast)

        # Color channel correlation (screens sometimes show subpixel patterns)
        b, g, r = cv2.split(face)
        corr_bg = abs(_corr(b, g))
        corr_rg = abs(_corr(r, g))
        # Natural skin: high but not perfect channel correlation
        corr_score = _clamp(1.0 - abs(((corr_bg + corr_rg) / 2.0) - 0.92) / 0.2)

        # Face should occupy a reasonable portion of the frame (webcam UX)
        fh, fw = face.shape[:2]
        fill = (fh * fw) / float(max(full.shape[0] * full.shape[1], 1))
        fill_score = _clamp((fill - 0.02) / 0.25)

        return float(
            0.30 * texture
            + 0.20 * sat_score
            + 0.20 * contrast
            + 0.15 * corr_score
            + 0.15 * fill_score
        )

    def _onnx_score(self, face: np.ndarray) -> float | None:
        if not self._sessions:
            return None
        scores = []
        for session in self._sessions:
            try:
                inp = session.get_inputs()[0]
                name = inp.name
                shape = inp.shape
                # Expect NCHW float; common sizes 80 or 128
                side = 80
                for dim in shape:
                    if isinstance(dim, int) and dim > 3:
                        side = dim
                        break
                resized = cv2.resize(face, (side, side))
                blob = resized.astype(np.float32) / 255.0
                blob = np.transpose(blob, (2, 0, 1))[np.newaxis, ...]
                out = session.run(None, {name: blob})[0]
                out = np.asarray(out).reshape(-1)
                if out.size >= 2:
                    # Common: [spoof, real] softmax
                    exp = np.exp(out - out.max())
                    prob = exp / exp.sum()
                    scores.append(float(prob[-1]))
                else:
                    scores.append(float(1.0 / (1.0 + np.exp(-out[0]))))
            except Exception:
                continue
        if not scores:
            return None
        return float(sum(scores) / len(scores))


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    af = a.astype(np.float32).ravel()
    bf = b.astype(np.float32).ravel()
    af = af - af.mean()
    bf = bf - bf.mean()
    denom = float(np.linalg.norm(af) * np.linalg.norm(bf))
    if denom < 1e-6:
        return 0.0
    return float(np.dot(af, bf) / denom)


def anti_spoof_model_hint() -> str:
    path = Path(ANTI_SPOOF_DIR)
    if any(path.glob("*.onnx")):
        return "onnx models loaded"
    return (
        f"Place MiniFASNet/Silent-Face ONNX weights in {path} "
        "for stronger passive anti-spoofing; heuristic fallback is active."
    )
