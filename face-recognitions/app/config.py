import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
IDENTITIES_DIR = DATA_DIR / "identities"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
MODELS_DIR = BASE_DIR / "models"
ANTI_SPOOF_DIR = MODELS_DIR / "anti_spoof"

EMOTION_MODEL_PATH = MODELS_DIR / "_mini_XCEPTION.106-0.65.hdf5"
HAAR_PATH = MODELS_DIR / "haarcascade_frontalface_default.xml"

HOST = os.getenv("FACE_HOST", "0.0.0.0")
PORT = int(os.getenv("FACE_PORT", "9000"))
DEBUG = os.getenv("FACE_DEBUG", "false").lower() in ("1", "true", "yes")
ENV = os.getenv("ENV", "development")

API_KEY = os.getenv("FACE_API_KEY", "")
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "FACE_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

MAX_UPLOAD_BYTES = int(os.getenv("FACE_MAX_UPLOAD_MB", "8")) * 1024 * 1024
RATE_LIMIT = os.getenv("FACE_RATE_LIMIT", "60 per minute")

# ArcFace cosine similarity (normed embeddings → dot product)
VERIFY_THRESHOLD = float(os.getenv("FACE_VERIFY_THRESHOLD", "0.45"))
IDENTIFY_THRESHOLD = float(os.getenv("FACE_IDENTIFY_THRESHOLD", "0.40"))

# Enrollment
MIN_ENROLL_SAMPLES = int(os.getenv("FACE_MIN_ENROLL_SAMPLES", "3"))
MAX_ENROLL_SAMPLES = int(os.getenv("FACE_MAX_ENROLL_SAMPLES", "5"))
MIN_FACE_SIZE = int(os.getenv("FACE_MIN_FACE_SIZE", "80"))
MIN_SHARPNESS = float(os.getenv("FACE_MIN_SHARPNESS", "40.0"))

# InsightFace
INSIGHTFACE_MODEL = os.getenv("FACE_INSIGHTFACE_MODEL", "buffalo_s")
DET_SIZE = (
    int(os.getenv("FACE_DET_SIZE", "640")),
    int(os.getenv("FACE_DET_SIZE", "640")),
)

# Liveness
LIVENESS_THRESHOLD = float(os.getenv("FACE_LIVENESS_THRESHOLD", "0.55"))
REQUIRE_LIVENESS_VERIFY = os.getenv("FACE_REQUIRE_LIVENESS_VERIFY", "true").lower() in (
    "1",
    "true",
    "yes",
)
REQUIRE_LIVENESS_IDENTIFY = os.getenv(
    "FACE_REQUIRE_LIVENESS_IDENTIFY", "false"
).lower() in ("1", "true", "yes")

EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]


def ensure_dirs() -> None:
    for path in (DATA_DIR, IDENTITIES_DIR, EMBEDDINGS_DIR, ANTI_SPOOF_DIR):
        path.mkdir(parents=True, exist_ok=True)
