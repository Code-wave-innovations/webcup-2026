#!/usr/bin/env python3
"""Download and extract InsightFace buffalo_s weights."""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_s.zip"
TARGET_DIR = Path.home() / ".insightface" / "models"
ZIP_PATH = TARGET_DIR / "buffalo_s.zip"
EXTRACT_DIR = TARGET_DIR / "buffalo_s"


def main() -> int:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    if EXTRACT_DIR.exists() and any(EXTRACT_DIR.glob("*.onnx")):
        print(f"Already present: {EXTRACT_DIR}")
        return 0

    print(f"Downloading {URL}")
    print(f" -> {ZIP_PATH}")

    def _progress(block: int, block_size: int, total: int) -> None:
        if total <= 0:
            return
        done = min(block * block_size, total)
        pct = 100.0 * done / total
        print(f"\r{pct:6.2f}% ({done // 1024} / {total // 1024} KB)", end="", flush=True)

    urlretrieve(URL, ZIP_PATH, reporthook=_progress)
    print()

    if not zipfile.is_zipfile(ZIP_PATH):
        print("Download corrupt (not a zip). Delete and retry.", file=sys.stderr)
        return 1

    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        zf.extractall(EXTRACT_DIR)
    print(f"Extracted to {EXTRACT_DIR}")
    for p in sorted(EXTRACT_DIR.glob("*.onnx")):
        print(f"  - {p.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
