#!/usr/bin/env python3
"""Build separate AI-enhanced web panoramas without changing the originals."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
STYLES = ["forest", "japanese", "french", "sunlit"]
ROOMS = ["living", "dining", "master", "study", "guest", "kitchen", "bathroom"]
RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_web(style: str, room: str, master: Path, strength: float,
               source_root: Path, output_root: Path) -> dict:
    source = source_root / style / f"{room}.jpg"
    original = Image.open(source).convert("RGB")
    neural = Image.open(master).convert("RGB")
    if neural.size != (original.width * 4, original.height * 4):
        raise ValueError(f"{style}/{room}: incorrect 4x master dimensions")
    # Keep a small amount of the original's texture to avoid an overly
    # denoised or painted appearance. This is labelled as inferred detail.
    enhanced = Image.blend(original.resize(neural.size, RESAMPLE), neural, strength)
    downsampled = enhanced.resize(original.size, RESAMPLE).filter(ImageFilter.GaussianBlur(4))
    reference = original.filter(ImageFilter.GaussianBlur(4))
    color_error = float(np.abs(np.asarray(reference, dtype=np.float32) -
                               np.asarray(downsampled, dtype=np.float32)).mean())
    if color_error > 5:
        raise ValueError(f"{style}/{room}: excessive broad color change ({color_error:.2f}/255)")
    directory = output_root / style
    directory.mkdir(parents=True, exist_ok=True)
    assets = []
    for image, suffix in [(enhanced, ""),
                          (enhanced.resize((original.width * 2, original.height * 2), RESAMPLE), "-2x")]:
        target = directory / f"{room}{suffix}.jpg"
        temporary = target.with_suffix(".jpg.tmp")
        image.save(temporary, format="JPEG", quality=94, subsampling=0, optimize=True, progressive=True)
        temporary.replace(target)
        assets.append({"path": str(target.relative_to(ROOT)), "dimensions": list(image.size),
                       "bytes": target.stat().st_size, "sha256": digest(target)})
    inference = json.loads(master.with_suffix(".json").read_text())
    record = {"style": style, "room": room, "source": str(source.relative_to(ROOT)),
              "source_sha256": digest(source), "source_dimensions": list(original.size),
              "model_sha256": inference["model_sha256"], "strength": strength,
              "low_frequency_color_mae_255": round(color_error, 4), "assets": assets,
              "master": str(master.relative_to(ROOT)), "tile": inference["tile"],
              "halo": inference["halo"], "longitude_padding": inference["longitude_padding"]}
    master.with_name(f"{room}-web.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, default=Path("artifacts/panorama-superres-20261027"))
    parser.add_argument("--source-root", type=Path, default=Path("public/panoramas"))
    parser.add_argument("--output-root", type=Path, default=Path("public/panoramas-hd"))
    parser.add_argument("--date", default="2026-10-27")
    parser.add_argument("--styles", nargs="+", default=STYLES, choices=STYLES)
    parser.add_argument("--rooms", nargs="+", default=ROOMS, choices=ROOMS)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--strength", type=float, default=0.85)
    args = parser.parse_args()
    if not 0 <= args.strength <= 1 or args.workers < 1:
        parser.error("Invalid strength or worker count")
    model = args.model.resolve()
    model_hash = digest(model)
    artifact_root = (ROOT / args.artifacts).resolve()
    source_root = (ROOT / args.source_root).resolve()
    output_root = (ROOT / args.output_root).resolve()
    started = time.monotonic()

    def build(job: tuple[str, str]) -> dict:
        style, room = job
        directory = artifact_root / style
        directory.mkdir(parents=True, exist_ok=True)
        master = directory / f"{room}-wdn-4x-master.png"
        source = source_root / style / f"{room}.jpg"
        if master.exists():
            meta = json.loads(master.with_suffix(".json").read_text())
            if (meta["model_sha256"] != model_hash or meta["source_sha256"] != digest(source)
                    or meta.get("output_sha256") != digest(master)
                    or meta.get("scale") != 4 or meta.get("strength") != 1.0):
                raise ValueError(f"{style}/{room}: existing master is not an intact, unmixed result of this source/model")
        else:
            with (directory / f"{room}-inference.log").open("w") as log:
                subprocess.run([sys.executable, str(ROOT / "scripts/upscale-panoramas.py"),
                                "--model", str(model), "--source", str(source), "--output", str(master),
                                "--threads", str(args.threads), "--tile", "256", "--halo", "40"],
                               cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
        return export_web(style, room, master, args.strength, source_root, output_root)

    jobs = [(style, room) for style in args.styles for room in args.rooms]
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(build, job): job for job in jobs}
        for future in concurrent.futures.as_completed(futures):
            record = future.result()
            records.append(record)
            print(json.dumps({"completed": f"{record['style']}/{record['room']}",
                              "count": len(records), "total": len(jobs),
                              "elapsed_seconds": round(time.monotonic() - started, 1)}), flush=True)
    manifest = {"date": args.date, "method": "AI super-resolution; inferred, not native render detail",
                "model": "Real-ESRGAN general-wdn-x4v3", "model_sha256": model_hash,
                "source_repository": "https://github.com/xinntao/Real-ESRGAN",
                "records": sorted(records, key=lambda r: (STYLES.index(r["style"]), ROOMS.index(r["room"])))}
    (artifact_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
