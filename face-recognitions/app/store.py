from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.config import EMBEDDINGS_DIR, IDENTITIES_DIR, ensure_dirs


class EmbeddingStore:
    """In-memory gallery of L2-normalized ArcFace embeddings, persisted on disk."""

    def __init__(self) -> None:
        ensure_dirs()
        self._lock = threading.RLock()
        self._names: list[str] = []
        self._matrix: np.ndarray | None = None  # (N, D)
        self.reload()

    def reload(self) -> None:
        with self._lock:
            names: list[str] = []
            vectors: list[np.ndarray] = []
            for path in sorted(EMBEDDINGS_DIR.glob("*.npy")):
                name = path.stem
                vec = np.load(path)
                vec = np.asarray(vec, dtype=np.float32).reshape(-1)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                names.append(name)
                vectors.append(vec)
            self._names = names
            self._matrix = np.stack(vectors, axis=0) if vectors else None

    @property
    def identities(self) -> list[str]:
        with self._lock:
            return list(self._names)

    def count(self) -> int:
        with self._lock:
            return len(self._names)

    def upsert(self, name: str, embedding: np.ndarray) -> None:
        ensure_dirs()
        vec = np.asarray(embedding, dtype=np.float32).reshape(-1)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        path = EMBEDDINGS_DIR / f"{name}.npy"
        with self._lock:
            np.save(path, vec)
            if name in self._names:
                idx = self._names.index(name)
                assert self._matrix is not None
                self._matrix[idx] = vec
            else:
                self._names.append(name)
                if self._matrix is None:
                    self._matrix = vec.reshape(1, -1)
                else:
                    self._matrix = np.vstack([self._matrix, vec])

    def delete(self, name: str) -> bool:
        with self._lock:
            path = EMBEDDINGS_DIR / f"{name}.npy"
            identity_dir = IDENTITIES_DIR / name
            existed = path.exists() or identity_dir.exists()
            if path.exists():
                path.unlink()
            if identity_dir.exists():
                for child in identity_dir.rglob("*"):
                    if child.is_file():
                        child.unlink()
                for child in sorted(identity_dir.rglob("*"), reverse=True):
                    if child.is_dir():
                        child.rmdir()
                if identity_dir.exists():
                    identity_dir.rmdir()
            if name in self._names:
                idx = self._names.index(name)
                self._names.pop(idx)
                if self._matrix is not None:
                    self._matrix = np.delete(self._matrix, idx, axis=0)
                    if self._matrix.shape[0] == 0:
                        self._matrix = None
            return existed

    def identify(
        self, embedding: np.ndarray, threshold: float
    ) -> tuple[str | None, float]:
        """Return best identity and cosine score, or (None, score) if below threshold."""
        with self._lock:
            if self._matrix is None or not self._names:
                return None, 0.0
            vec = np.asarray(embedding, dtype=np.float32).reshape(-1)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            scores = self._matrix @ vec
            idx = int(np.argmax(scores))
            score = float(scores[idx])
            if score < threshold:
                return None, score
            return self._names[idx], score

    def verify(
        self, name: str, embedding: np.ndarray, threshold: float
    ) -> tuple[bool, float]:
        with self._lock:
            if name not in self._names or self._matrix is None:
                return False, 0.0
            idx = self._names.index(name)
            vec = np.asarray(embedding, dtype=np.float32).reshape(-1)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            score = float(self._matrix[idx] @ vec)
            return score >= threshold, score


def identity_dir(name: str) -> Path:
    path = IDENTITIES_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    (path / "samples").mkdir(exist_ok=True)
    return path


def save_sample(name: str, image_bgr: np.ndarray, index: int) -> Path:
    import cv2

    directory = identity_dir(name)
    out = directory / "samples" / f"{index:03d}.jpg"
    cv2.imwrite(str(out), image_bgr)
    meta_path = directory / "meta.json"
    meta = {
        "name": name,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "sample_count": index + 1,
    }
    if meta_path.exists():
        try:
            existing = json.loads(meta_path.read_text())
            meta["created_at"] = existing.get("created_at", meta["updated_at"])
        except (json.JSONDecodeError, OSError):
            meta["created_at"] = meta["updated_at"]
    else:
        meta["created_at"] = meta["updated_at"]
    meta_path.write_text(json.dumps(meta, indent=2))
    return out


def mean_embedding(embeddings: list[np.ndarray]) -> np.ndarray:
    stacked = np.stack(
        [np.asarray(e, dtype=np.float32).reshape(-1) for e in embeddings], axis=0
    )
    mean = stacked.mean(axis=0)
    norm = np.linalg.norm(mean)
    if norm > 0:
        mean = mean / norm
    return mean.astype(np.float32)
