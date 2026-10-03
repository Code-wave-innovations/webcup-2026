from __future__ import annotations

import logging

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.config import (
    CORS_ORIGINS,
    DEBUG,
    HOST,
    MAX_UPLOAD_BYTES,
    PORT,
    RATE_LIMIT,
    ensure_dirs,
)
from app.pipeline import FacePipeline
from app.routes import bp
from app.store import EmbeddingStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    ensure_dirs()
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

    CORS(app, origins=CORS_ORIGINS, supports_credentials=False)

    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[RATE_LIMIT],
        storage_uri="memory://",
    )
    app.extensions["limiter"] = limiter

    pipeline = FacePipeline()
    store = EmbeddingStore()
    app.extensions["face_pipeline"] = pipeline
    app.extensions["face_store"] = store

    app.register_blueprint(bp)

    @app.errorhandler(413)
    def too_large(_err):
        return jsonify({"ok": False, "error": "File too large"}), 413

    @app.errorhandler(429)
    def rate_limited(_err):
        return jsonify({"ok": False, "error": "Rate limit exceeded"}), 429

    logger.info(
        "Face API up (InsightFace lazy-load) identities=%s",
        store.count(),
    )
    return app


def main() -> None:
    application = create_app()
    application.run(host=HOST, port=PORT, debug=DEBUG)


if __name__ == "__main__":
    main()
