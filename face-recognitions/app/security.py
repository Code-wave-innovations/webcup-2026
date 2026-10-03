import re
import secrets
from functools import wraps
from typing import Callable

from flask import Request, jsonify, request

from app.config import API_KEY, ENV

_SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def sanitize_identity_name(raw: str | None) -> str | None:
    if raw is None:
        return None
    name = raw.strip()
    if not name or not _SAFE_NAME.match(name):
        return None
    if ".." in name or "/" in name or "\\" in name:
        return None
    return name


def require_api_key(view: Callable):
    """Enforce X-API-Key when FACE_API_KEY is configured."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if not API_KEY:
            if ENV == "production":
                return jsonify({"ok": False, "error": "Server misconfigured: FACE_API_KEY"}), 503
            return view(*args, **kwargs)
        provided = request.headers.get("X-API-Key", "")
        if not secrets.compare_digest(provided, API_KEY):
            return jsonify({"ok": False, "error": "Unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapped


def read_image_bytes(req: Request, field: str = "img") -> tuple[bytes | None, str | None]:
    if field not in req.files:
        return None, "No file part"
    file = req.files[field]
    if not file or file.filename == "":
        return None, "No selected file"
    data = file.read()
    if not data:
        return None, "Empty file"
    return data, None
