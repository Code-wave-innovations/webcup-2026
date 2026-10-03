"""Offline checks that do not require InsightFace weights."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.security import sanitize_identity_name
from app.store import EmbeddingStore, mean_embedding
import numpy as np


def main() -> None:
    assert sanitize_identity_name("alice") == "alice"
    assert sanitize_identity_name("../etc") is None
    assert sanitize_identity_name("a/b") is None
    assert sanitize_identity_name("") is None

    a = np.ones(8, dtype=np.float32)
    b = np.ones(8, dtype=np.float32) * 2
    m = mean_embedding([a, b])
    assert abs(float(np.linalg.norm(m)) - 1.0) < 1e-5

    store = EmbeddingStore()
    store.upsert("_smoke_user", m)
    hit, score = store.verify("_smoke_user", m, 0.9)
    assert hit and score > 0.99
    ident, score2 = store.identify(m, 0.5)
    assert ident == "_smoke_user"
    assert store.delete("_smoke_user")
    print("smoke_test OK")


if __name__ == "__main__":
    main()
