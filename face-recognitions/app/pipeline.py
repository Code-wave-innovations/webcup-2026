from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import DET_SIZE, INSIGHTFACE_MODEL
from app.emotion import EmotionEstimator
from app.liveness import LivenessChecker
from app.quality import assess_face_quality

logger = logging.getLogger(__name__)


@dataclass
class DetectedFace:
    bbox: tuple[int, int, int, int]  # x1,y1,x2,y2
    embedding: np.ndarray
    det_score: float


class FacePipeline:
    def __init__(self) -> None:
        self._app = None
        self._init_error: str | None = None
        self._init_attempted = False
        self.liveness = LivenessChecker()
        self.emotion = EmotionEstimator()

    def _init_insightface(self) -> None:
        if self._app is not None or self._init_attempted:
            return
        self._init_attempted = True
        try:
            from insightface.app import FaceAnalysis

            providers = ["CPUExecutionProvider"]
            try:
                import onnxruntime as ort

                avail = ort.get_available_providers()
                if "CUDAExecutionProvider" in avail:
                    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            except Exception:
                pass

            self._app = FaceAnalysis(name=INSIGHTFACE_MODEL, providers=providers)
            self._app.prepare(
                ctx_id=0 if providers[0].startswith("CUDA") else -1,
                det_size=DET_SIZE,
            )
            logger.info(
                "InsightFace model %s ready (%s)", INSIGHTFACE_MODEL, providers[0]
            )
        except Exception as exc:
            logger.error("InsightFace init failed: %s", exc)
            self._init_error = str(exc)
            self._app = None

    @property
    def ready(self) -> bool:
        # Eager readiness only if already loaded; call ensure() before inference.
        return self._app is not None

    def ensure(self) -> bool:
        self._init_insightface()
        return self._app is not None

    def decode_image(self, data: bytes) -> np.ndarray | None:
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img

    def detect_best(self, image_bgr: np.ndarray) -> DetectedFace | None:
        if not self.ensure():
            return None
        faces = self._app.get(image_bgr)
        if not faces:
            return None
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        x1, y1, x2, y2 = [int(v) for v in face.bbox]
        emb = np.asarray(face.normed_embedding, dtype=np.float32)
        return DetectedFace(
            bbox=(x1, y1, x2, y2),
            embedding=emb,
            det_score=float(getattr(face, "det_score", 1.0)),
        )

    def analyze(
        self,
        image_bgr: np.ndarray,
        *,
        check_quality: bool = False,
        check_liveness: bool = False,
        check_emotion: bool = False,
    ) -> dict:
        if not self.ensure():
            return {
                "ok": False,
                "error": self._init_error or "Face engine not ready (InsightFace)",
            }

        detected = self.detect_best(image_bgr)
        if detected is None:
            return {"ok": False, "error": "Face not found"}

        result: dict = {
            "ok": True,
            "bbox": list(detected.bbox),
            "det_score": round(detected.det_score, 4),
            "embedding": detected.embedding,
        }

        if check_quality:
            q = assess_face_quality(image_bgr, detected.bbox)
            result["quality"] = q
            if not q["ok"]:
                result["ok"] = False
                result["error"] = q.get("reason") or "quality_failed"

        if check_liveness:
            live = self.liveness.score(image_bgr, detected.bbox)
            result["liveness"] = {k: v for k, v in live.items()}
            if not live["ok"]:
                result["ok"] = False
                result["error"] = result.get("error") or "liveness_failed"

        if check_emotion:
            emo = self.emotion.predict_from_image(image_bgr, detected.bbox)
            if emo is None:
                result["emotion"] = None
                if check_emotion and "error" not in result:
                    pass
            else:
                result["emotion"] = {
                    "label": emo["label"],
                    "score": round(emo["score"], 4),
                }

        return result
