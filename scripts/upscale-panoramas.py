#!/usr/bin/env python3
"""Run a local RGB ONNX super-resolution model on periodic 360 panoramas.

No images leave the machine. Original panoramas are never overwritten.
Horizontal context wraps around the longitude seam; vertical context reflects.
An inference halo is discarded on every tile, avoiding internal tile borders.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def upscale(image: np.ndarray, session: ort.InferenceSession, tile: int,
            halo: int, scale: int) -> np.ndarray:
    height, width = image.shape[:2]
    # Reflect the latitude boundary, then repeat longitude independently.
    padded = np.pad(image, ((halo, halo), (0, 0), (0, 0)), mode="reflect")
    padded = np.pad(padded, ((0, 0), (halo, halo), (0, 0)), mode="wrap")
    result = np.empty((height * scale, width * scale, 3), dtype=np.uint8)
    input_name = session.get_inputs()[0].name
    count = ((height + tile - 1) // tile) * ((width + tile - 1) // tile)
    started = time.monotonic()
    index = 0
    for top in range(0, height, tile):
        bottom = min(top + tile, height)
        for left in range(0, width, tile):
            right = min(left + tile, width)
            patch = padded[top:bottom + 2 * halo, left:right + 2 * halo]
            tensor = np.ascontiguousarray(patch.transpose(2, 0, 1)[None], dtype=np.float32) / 255.0
            predicted = session.run(None, {input_name: tensor})[0]
            expected = (1, 3, patch.shape[0] * scale, patch.shape[1] * scale)
            if predicted.shape != expected or not np.isfinite(predicted).all():
                raise ValueError(f"Invalid model output: {predicted.shape}; expected {expected}")
            crop = predicted[0, :, halo * scale:(halo + bottom - top) * scale,
                             halo * scale:(halo + right - left) * scale]
            result[top * scale:bottom * scale, left * scale:right * scale] = (
                np.clip(crop.transpose(1, 2, 0), 0, 1) * 255.0
            ).round().astype(np.uint8)
            index += 1
            print(json.dumps({"tile": index, "tiles": count,
                              "elapsed_seconds": round(time.monotonic() - started, 1)}), flush=True)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--tile", type=int, default=256)
    parser.add_argument("--halo", type=int, default=40)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--strength", type=float, default=1.0,
                        help="Blend neural reconstruction with Lanczos; 1 = full model output.")
    args = parser.parse_args()
    if args.tile < 16 or args.halo < 1 or not 0 <= args.strength <= 1:
        parser.error("Invalid tile, halo or strength")
    if args.output.resolve() == args.source.resolve() or args.output.exists():
        parser.error("Output must be a new file, separate from the original")
    if args.output.suffix.lower() != ".png":
        parser.error("Use a .png output for the lossless reconstruction master")
    original = Image.open(args.source).convert("RGB")
    if original.width != original.height * 2:
        parser.error("Source must be a 2:1 equirectangular panorama")
    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_mem_pattern = False
    options.add_session_config_entry("session.intra_op.allow_spinning", "0")
    session = ort.InferenceSession(str(args.model), sess_options=options,
                                   providers=["CPUExecutionProvider"])
    started = time.monotonic()
    reconstructed = Image.fromarray(upscale(np.asarray(original), session, args.tile,
                                           args.halo, args.scale))
    if args.strength < 1:
        base = original.resize(reconstructed.size, getattr(Image, "Resampling", Image).LANCZOS)
        reconstructed = Image.blend(base, reconstructed, args.strength)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # A lossless master is retained for review and subsequent web exports.
    temporary = args.output.with_suffix(".png.tmp")
    reconstructed.save(temporary, format="PNG", compress_level=3)
    temporary.replace(args.output)
    record = {
        "source": str(args.source), "source_sha256": sha256(args.source),
        "source_dimensions": list(original.size), "output": str(args.output),
        "output_sha256": sha256(args.output), "output_dimensions": list(reconstructed.size),
        "model": str(args.model), "model_sha256": sha256(args.model),
        "method": "local neural super-resolution; inferred detail, not native high-resolution rendering",
        "scale": args.scale, "strength": args.strength, "tile": args.tile, "halo": args.halo,
        "longitude_padding": "periodic", "latitude_padding": "reflect", "threads": args.threads,
        "onnxruntime": ort.__version__, "seconds": round(time.monotonic() - started, 2),
    }
    args.output.with_suffix(".json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(record, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
