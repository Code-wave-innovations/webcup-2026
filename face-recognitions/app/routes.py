from __future__ import annotations

import logging

from flask import Blueprint, current_app, jsonify, request

from app.config import (
    IDENTIFY_THRESHOLD,
    MAX_ENROLL_SAMPLES,
    MIN_ENROLL_SAMPLES,
    REQUIRE_LIVENESS_IDENTIFY,
    REQUIRE_LIVENESS_VERIFY,
    VERIFY_THRESHOLD,
)
from app.liveness import anti_spoof_model_hint
from app.security import read_image_bytes, require_api_key, sanitize_identity_name
from app.store import mean_embedding, save_sample

logger = logging.getLogger(__name__)

bp = Blueprint("face", __name__)


def _pipeline():
    return current_app.extensions["face_pipeline"]


def _store():
    return current_app.extensions["face_store"]


def _public_analyze(result: dict) -> dict:
    """Strip embedding from API responses."""
    out = {k: v for k, v in result.items() if k != "embedding"}
    return out


@bp.get("/health")
def health():
    pipe = _pipeline()
    store = _store()
    # Lazy-load InsightFace on first face call; health reports current state.
    return jsonify(
        {
            "ok": True,
            "engine": "insightface" if pipe.ready else "insightface_lazy",
            "engine_loaded": pipe.ready,
            "identities": store.count(),
            "emotion": pipe.emotion.available,
            "liveness_backend": pipe.liveness.backend,
            "liveness_hint": anti_spoof_model_hint(),
            "thresholds": {
                "verify": VERIFY_THRESHOLD,
                "identify": IDENTIFY_THRESHOLD,
            },
        }
    )


@bp.get("/identities")
@require_api_key
def list_identities():
    return jsonify({"ok": True, "identities": _store().identities})


@bp.post("/enroll")
@require_api_key
def enroll():
    """
    Multi-sample enrollment.
    - Single shot: form fields `img` + `name` (appends one sample; commits when >= MIN)
    - Batch: `img0..imgN` + `name` (commits immediately if enough samples)
    """
    name = sanitize_identity_name(request.form.get("name") or request.form.get("names"))
    if not name:
        return jsonify({"ok": False, "error": "Invalid or missing name"}), 400

    pipe = _pipeline()
    store = _store()
    if not pipe.ensure():
        return jsonify({"ok": False, "error": "Face engine not ready"}), 503

    files = []
    if "img" in request.files and request.files["img"].filename:
        files.append(request.files["img"].read())
    for i in range(MAX_ENROLL_SAMPLES):
        key = f"img{i}"
        if key in request.files and request.files[key].filename:
            files.append(request.files[key].read())

    if not files:
        return jsonify({"ok": False, "error": "No file part"}), 400
    if len(files) > MAX_ENROLL_SAMPLES:
        return jsonify(
            {"ok": False, "error": f"Max {MAX_ENROLL_SAMPLES} samples per request"}
        ), 400

    import cv2

    from app.config import IDENTITIES_DIR

    samples_meta = []
    decoded: list = []
    for data in files:
        image = pipe.decode_image(data)
        if image is None:
            return jsonify({"ok": False, "error": "Invalid image"}), 400
        result = pipe.analyze(image, check_quality=True, check_liveness=False)
        if not result.get("ok"):
            return jsonify(_public_analyze(result)), 400
        decoded.append(image)
        samples_meta.append({"quality": result["quality"], "bbox": result["bbox"]})

    samples_dir = IDENTITIES_DIR / name / "samples"
    existing = sorted(samples_dir.glob("*.jpg")) if samples_dir.exists() else []
    start = len(existing)
    for i, image in enumerate(decoded):
        save_sample(name, image, start + i)

    sample_paths = sorted((IDENTITIES_DIR / name / "samples").glob("*.jpg"))
    all_embs = []
    for path in sample_paths[-MAX_ENROLL_SAMPLES:]:
        img = cv2.imread(str(path))
        if img is None:
            continue
        det = pipe.detect_best(img)
        if det is not None:
            all_embs.append(det.embedding)

    if len(all_embs) < MIN_ENROLL_SAMPLES:
        return jsonify(
            {
                "ok": True,
                "committed": False,
                "name": name,
                "samples": len(all_embs),
                "required": MIN_ENROLL_SAMPLES,
                "message": "Sample accepted; send more frames to commit enrollment",
                "last_quality": samples_meta[-1]["quality"] if samples_meta else None,
            }
        )

    if not all_embs:
        return jsonify({"ok": False, "error": "No usable face samples"}), 400

    store.upsert(name, mean_embedding(all_embs))
    return jsonify(
        {
            "ok": True,
            "committed": True,
            "name": name,
            "samples": len(all_embs),
            "identities": store.count(),
        }
    )


@bp.post("/identify")
@require_api_key
def identify():
    data, err = read_image_bytes(request)
    if err:
        return jsonify({"ok": False, "error": err}), 400
    if len(data) > current_app.config["MAX_CONTENT_LENGTH"]:
        return jsonify({"ok": False, "error": "File too large"}), 413

    pipe = _pipeline()
    store = _store()
    image = pipe.decode_image(data)
    if image is None:
        return jsonify({"ok": False, "error": "Invalid image"}), 400

    result = pipe.analyze(
        image,
        check_liveness=REQUIRE_LIVENESS_IDENTIFY,
        check_emotion=False,
    )
    if "embedding" not in result:
        return jsonify(_public_analyze(result)), 400
    if REQUIRE_LIVENESS_IDENTIFY and not result.get("liveness", {}).get("ok", False):
        body = _public_analyze(result)
        body["ok"] = False
        body["error"] = "liveness_failed"
        return jsonify(body), 400

    identity, score = store.identify(result["embedding"], IDENTIFY_THRESHOLD)
    body = _public_analyze(result)
    body.update(
        {
            "ok": identity is not None,
            "identity": identity,
            "score": round(score, 4),
            "threshold": IDENTIFY_THRESHOLD,
            "matched": identity is not None,
        }
    )
    if identity is None:
        body["error"] = "unknown"
        return jsonify(body), 404
    return jsonify(body)


@bp.post("/verify")
@require_api_key
def verify():
    name = sanitize_identity_name(request.form.get("name"))
    if not name:
        return jsonify({"ok": False, "error": "Invalid or missing name"}), 400
    data, err = read_image_bytes(request)
    if err:
        return jsonify({"ok": False, "error": err}), 400

    pipe = _pipeline()
    store = _store()
    image = pipe.decode_image(data)
    if image is None:
        return jsonify({"ok": False, "error": "Invalid image"}), 400

    result = pipe.analyze(image, check_liveness=REQUIRE_LIVENESS_VERIFY)
    if "embedding" not in result:
        return jsonify(_public_analyze(result)), 400
    if REQUIRE_LIVENESS_VERIFY and not result.get("liveness", {}).get("ok", False):
        body = _public_analyze(result)
        body["ok"] = False
        body["verified"] = False
        body["error"] = "liveness_failed"
        return jsonify(body), 400

    matched, score = store.verify(name, result["embedding"], VERIFY_THRESHOLD)
    body = _public_analyze(result)
    body.update(
        {
            "ok": matched,
            "verified": matched,
            "identity": name,
            "score": round(score, 4),
            "threshold": VERIFY_THRESHOLD,
        }
    )
    if not matched:
        body["error"] = "mismatch"
        return jsonify(body), 401
    return jsonify(body)


@bp.post("/emotion")
@require_api_key
def emotion():
    data, err = read_image_bytes(request)
    if err:
        return jsonify({"ok": False, "error": err}), 400
    pipe = _pipeline()
    image = pipe.decode_image(data)
    if image is None:
        return jsonify({"ok": False, "error": "Invalid image"}), 400

    result = pipe.analyze(image, check_emotion=True)
    body = _public_analyze(result)
    if not result.get("ok") and "embedding" not in result:
        return jsonify(body), 400
    if not body.get("emotion"):
        return jsonify({"ok": False, "error": "No face detected or emotion unavailable"}), 400
    body["ok"] = True
    body["label"] = body["emotion"]["label"]
    return jsonify(body)


@bp.delete("/identities/<name>")
@require_api_key
def delete_identity(name: str):
    safe = sanitize_identity_name(name)
    if not safe:
        return jsonify({"ok": False, "error": "Invalid name"}), 400
    deleted = _store().delete(safe)
    if not deleted:
        return jsonify({"ok": False, "error": "Identity not found"}), 404
    return jsonify({"ok": True, "deleted": safe})


# --- Legacy aliases (JSON responses) ---


@bp.post("/create-dataset")
@require_api_key
def legacy_create():
    return enroll()


@bp.post("/recognize")
@require_api_key
def legacy_recognize():
    return identify()


@bp.delete("/delete-dataset")
@require_api_key
def legacy_delete():
    name = sanitize_identity_name(request.form.get("name"))
    if not name:
        return jsonify({"ok": False, "error": "Invalid or missing name"}), 400
    deleted = _store().delete(name)
    if not deleted:
        return jsonify({"ok": False, "error": "Identity not found"}), 404
    return jsonify({"ok": True, "deleted": name})
