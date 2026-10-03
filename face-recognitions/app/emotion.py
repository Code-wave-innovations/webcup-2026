from __future__ import annotations

import logging

import cv2
import numpy as np

from app.config import EMOTION_MODEL_PATH, EMOTIONS, HAAR_PATH

logger = logging.getLogger(__name__)


class EmotionEstimator:
    def __init__(self) -> None:
        self._model = None
        self._cascade = None
        self._load()

    def _load(self) -> None:
        if HAAR_PATH.exists():
            self._cascade = cv2.CascadeClassifier(str(HAAR_PATH))
        if not EMOTION_MODEL_PATH.exists():
            logger.warning("Emotion model missing at %s", EMOTION_MODEL_PATH)
            return
        try:
            from keras.models import load_model

            self._model = load_model(str(EMOTION_MODEL_PATH), compile=False)
        except Exception as exc:
            logger.warning("Could not load emotion model: %s", exc)
            self._model = None

    @property
    def available(self) -> bool:
        return self._model is not None

    def predict_from_crop(self, face_bgr: np.ndarray) -> dict | None:
        if self._model is None or face_bgr.size == 0:
            return None
        gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
        roi = cv2.resize(gray, (48, 48)).astype("float") / 255.0
        roi = np.expand_dims(np.expand_dims(roi, axis=-1), axis=0)
        preds = self._model.predict(roi, verbose=0)[0]
        idx = int(np.argmax(preds))
        return {
            "label": EMOTIONS[idx],
            "score": float(np.max(preds)),
            "distribution": {
                EMOTIONS[i]: float(preds[i]) for i in range(len(EMOTIONS))
            },
        }

    def predict_from_image(
        self, image_bgr: np.ndarray, bbox: tuple[int, int, int, int] | None = None
    ) -> dict | None:
        if bbox is not None:
            x1, y1, x2, y2 = bbox
            h, w = image_bgr.shape[:2]
            crop = image_bgr[max(0, y1) : min(h, y2), max(0, x1) : min(w, x2)]
            return self.predict_from_crop(crop)

        if self._cascade is None:
            return None
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)
        if len(faces) == 0:
            return None
        # Largest face
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        return self.predict_from_crop(image_bgr[y : y + fh, x : x + fw])
