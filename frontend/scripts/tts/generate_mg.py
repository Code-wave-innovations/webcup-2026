#!/usr/bin/env python3
"""Generate Malagasy WAV files with Meta MMS-TTS (`facebook/mms-tts-mlg`).

Offline / free (CC-BY-NC). Output is meant for `useSpeakMessage` via
`speak(text, 'mg', { audioUrl: '/tts/<id>.mg.wav' })`.

Setup (Python 3.10–3.12 only — not 3.13/3.14; PyTorch wheels missing):

    cd frontend/scripts/tts
    python3.11 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt

Single phrase:

    python generate_mg.py --text "Salama Terra Nova" --out ../../public/tts/demo.mg.wav

Batch (JSON object id → Malagasy text):

    python generate_mg.py --manifest phrases.example.json --out-dir ../../public/tts
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


MODEL_ID = "facebook/mms-tts-mlg"
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = SCRIPT_DIR.parents[1] / "public" / "tts"


def _load_model():
    if sys.version_info >= (3, 13):
        print(
            f"Python {sys.version_info.major}.{sys.version_info.minor} has no PyTorch wheels yet.\n"
            "Recreate the venv with 3.11:\n"
            "  rm -rf .venv && python3.11 -m venv .venv && source .venv/bin/activate\n"
            "  pip install -r requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1)

    try:
        import torch
        from transformers import AutoTokenizer, VitsModel
    except ImportError as exc:
        print(
            "Missing deps. Run: pip install -r requirements.txt\n"
            f"({exc})",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    print(f"Loading {MODEL_ID} …")
    model = VitsModel.from_pretrained(MODEL_ID)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model.eval()
    return model, tokenizer, torch


def synthesize(model, tokenizer, torch, text: str):
    text = text.strip()
    if not text:
        raise ValueError("empty text")
    inputs = tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        waveform = model(**inputs).waveform
    data = waveform.squeeze().detach().cpu().float().numpy()
    rate = int(model.config.sampling_rate)
    return data, rate


def write_wav(path: Path, data, rate: int) -> None:
    import numpy as np
    from scipy.io import wavfile

    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(data, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    wavfile.write(str(path), rate, pcm)


def generate_one(model, tokenizer, torch, text: str, out: Path) -> None:
    data, rate = synthesize(model, tokenizer, torch, text)
    write_wav(out, data, rate)
    print(f"Wrote {out} ({rate} Hz, {len(data) / rate:.2f}s)")


def load_manifest(path: Path) -> dict[str, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("manifest must be a JSON object: { \"id\": \"malagasy text\", ... }")
    out: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise ValueError(f"invalid entry {key!r}: both key and value must be strings")
        out[key] = value
    return out


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", help="Single Malagasy sentence to synthesize")
    group.add_argument("--manifest", type=Path, help="JSON map of id → Malagasy text")
    parser.add_argument(
        "--out",
        type=Path,
        help="Output WAV path (required with --text)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help=f"Directory for batch WAVs (default: {DEFAULT_OUT_DIR})",
    )
    parser.add_argument(
        "--suffix",
        default=".mg.wav",
        help="Filename suffix for batch mode (default: .mg.wav → <id>.mg.wav)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.text is not None:
        if args.out is None:
            print("--out is required with --text", file=sys.stderr)
            return 2
        model, tokenizer, torch = _load_model()
        generate_one(model, tokenizer, torch, args.text, args.out.resolve())
        return 0

    assert args.manifest is not None
    phrases = load_manifest(args.manifest.resolve())
    if not phrases:
        print("manifest is empty", file=sys.stderr)
        return 2

    model, tokenizer, torch = _load_model()
    out_dir = args.out_dir.resolve()
    for phrase_id, text in phrases.items():
        out = out_dir / f"{phrase_id}{args.suffix}"
        print(f"[{phrase_id}] {text!r}")
        generate_one(model, tokenizer, torch, text, out)
    print(f"Done — {len(phrases)} file(s) in {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
