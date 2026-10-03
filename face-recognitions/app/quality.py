import cv2
import numpy as np

from app.config import MIN_FACE_SIZE, MIN_SHARPNESS


def face_sharpness(gray_crop: np.ndarray) -> float:
    if gray_crop.size == 0:
        return 0.0
    return float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())


def assess_face_quality(
    image_bgr: np.ndarray,
    bbox: tuple[int, int, int, int],
) -> dict:
    """Return quality metrics and whether the sample is acceptable for enrollment."""
    x1, y1, x2, y2 = bbox
    h, w = image_bgr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    fw, fh = x2 - x1, y2 - y1
    crop = image_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return {
            "ok": False,
            "reason": "empty_crop",
            "face_width": 0,
            "face_height": 0,
            "sharpness": 0.0,
            "fill_ratio": 0.0,
        }

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sharpness = face_sharpness(gray)
    fill_ratio = (fw * fh) / float(max(w * h, 1))
    ok = fw >= MIN_FACE_SIZE and fh >= MIN_FACE_SIZE and sharpness >= MIN_SHARPNESS
    reason = None
    if fw < MIN_FACE_SIZE or fh < MIN_FACE_SIZE:
        reason = "face_too_small"
    elif sharpness < MIN_SHARPNESS:
        reason = "too_blurry"

    return {
        "ok": ok,
        "reason": reason,
        "face_width": int(fw),
        "face_height": int(fh),
        "sharpness": round(sharpness, 2),
        "fill_ratio": round(fill_ratio, 4),
    }
