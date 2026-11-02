#!/usr/bin/env python3
"""Offline panorama seam quilting and export of already generated API images.

No credentials, network calls or image-generation requests are used. API inputs
and raw outputs remain immutable; the exported master is a postprocessed image.
Default cut corridors stay within the central 30 percent edit mask: 4 to 14
percent of image width from its center, rather than using unmasked API drift.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import math
import threading
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STYLES = ("forest", "japanese", "french", "sunlit")
ROOMS = ("living", "dining", "master", "study", "guest", "kitchen", "bathroom")
DEFAULT_REPAIRS = ROOT / "output/imagegen/panoramas-native-20261028/seam-repair-wide"
DEFAULT_PUBLIC = ROOT / "public/panoramas-native"
RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS
PRINT_LOCK = threading.Lock()
SPEC = importlib.util.spec_from_file_location("panorama_seam_composer", ROOT / "scripts/compose-panorama-seams.py")
COMPOSER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPOSER)


def relative(path):
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, record):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def describe(path):
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        size, kind = list(image.size), image.format
    return {"path": relative(path), "dimensions": size, "format": kind,
            "bytes": path.stat().st_size, "sha256": sha(path)}


def save_png(image, path):
    temporary = path.with_name(path.name + ".tmp")
    image.save(temporary, format="PNG", compress_level=3)
    temporary.replace(path)


def save_jpeg(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    image.save(temporary, format="JPEG", quality=94, subsampling=0, optimize=True, progressive=True)
    temporary.replace(path)


def emit(**record):
    with PRINT_LOCK:
        print(json.dumps(record, ensure_ascii=False), flush=True)


def corridor(args, side):
    outer = getattr(args, side + "_outer_fraction")
    inner = getattr(args, side + "_inner_fraction")
    outer = args.outer_fraction if outer is None else outer
    inner = args.inner_fraction if inner is None else inner
    if not 0 < inner < outer < .5:
        raise ValueError(f"Require 0 < {side} inner fraction < outer fraction < .5")
    return outer, inner


def job(style, room, args):
    directory = args.repair_root / style / room
    record_path = directory / "manifest.json"
    original_record = json.loads(record_path.read_text(encoding="utf-8"))
    a_path, b_path = directory / "rolled-input.png", directory / "repair-raw.png"
    source_path = ROOT / original_record["source"]["path"]
    input_paths = (a_path, b_path, source_path)
    hashes = {path: sha(path) for path in input_paths}
    for field, path in (("source", source_path), ("rolled_input", a_path), ("repair_api_raw", b_path)):
        if original_record[field]["sha256"] != hashes[path]:
            raise ValueError(f"Input hash differs from seam manifest: {relative(path)}")
    a, b = COMPOSER.load(a_path), COMPOSER.load(b_path)
    height, width = a.shape[:2]
    center = width // 2
    native = np.roll(a, -center, axis=1)
    if not np.array_equal(native, COMPOSER.load(source_path)):
        raise ValueError(f"Rolled input differs from native source: {style}/{room}")
    lo, li = (round(width * v) for v in corridor(args, "left"))
    ro, ri = (round(width * v) for v in corridor(args, "right"))
    left, lm = COMPOSER.find_cut(a, b, center - lo, center - li, .7, .1, .2)
    right, rm = COMPOSER.find_cut(a, b, center + ri, center + ro, .7, .1, .2)
    blend = COMPOSER.weights(width, left, right, args.feather_pixels)
    combined = np.rint(a.astype(np.float32) * (1 - blend[..., None]) +
                       b.astype(np.float32) * blend[..., None]).astype(np.uint8)
    assert np.array_equal(combined[:, :center - lo - 3], a[:, :center - lo - 3])
    assert np.array_equal(combined[:, center + ro + 3:], a[:, center + ro + 3:])
    assert np.array_equal(combined[:, center - 2:center + 2], b[:, center - 2:center + 2])
    final = np.roll(combined, -center, axis=1)
    assert np.array_equal(final[:, 0], b[:, center])
    assert np.array_equal(final[:, -1], b[:, center - 1])

    output = args.record_root / style / room
    output.mkdir(parents=True, exist_ok=True)
    master_path = output / "quilted-composite.png"
    master = Image.fromarray(final)
    save_png(master, master_path)
    paths_path = output / "quilted-paths.json"
    write_json(paths_path, {"left_x_by_row": left.tolist(), "right_x_by_row": right.tolist()})
    assets = []
    for kind, size, suffix in (("desktop", (3840, 1920), ""),
                                ("mobile", (2560, 1280), "-mobile"),
                                ("thumbnail", (320, 160), "-thumb")):
        path = args.public_dir / style / f"{room}{suffix}.jpg"
        save_jpeg(master if size == master.size else master.resize(size, RESAMPLE), path)
        assets.append({"kind": kind, **describe(path)})
    previews = []
    for name, yaw in (("default", -math.pi / 2), ("wrap", math.pi)):
        path = args.artifacts / style / f"quilted-{room}-{name}.jpg"
        save_jpeg(COMPOSER.project(final, yaw, width=800, height=520), path)
        previews.append({"view": name, **describe(path)})
    yy = np.arange(height)
    before, after = COMPOSER.seam_metric(native), COMPOSER.seam_metric(final)
    postprocessing = {
        "kind": "masked AI seam repair plus two minimum-error dynamic-programming cuts; postprocessed master",
        "horizontal_roll_pixels": center,
        "algorithm": "Two independent monotone vertical cuts, moves -1/0/+1 per row; not general graph cut",
        "corridors": {side: {"outer_fraction": corridor(args, side)[0], "inner_fraction": corridor(args, side)[1]}
                      for side in ("left", "right")},
        "cut_cost": {"color_mae": 1, "gradient_difference": .7, "shared_edge_strength": .1, "horizontal_step": .2},
        "feather_total_width_pixels": args.feather_pixels,
        "mixed_pixel_fraction": float(((blend > 0) & (blend < 1)).mean()),
        "outside_search_corridors": "bit-exact original native pixels in lossless master",
        "final_wrap_boundary": "adjacent pixels from repaired center",
        "jpeg": {"quality": 94, "subsampling": 0, "progressive": True},
        "limitation": "Cuts minimize local pixel error; visual review is still required for objects and geometry"}
    record = {
        "style": style, "room": room, "status": "complete",
        "source": original_record["source"], "rolled_input": original_record["rolled_input"],
        "repair_api_raw": original_record["repair_api_raw"],
        "api": original_record.get("api"), "prompt": original_record.get("prompt"),
        "finished_master": describe(master_path), "assets": assets, "previews": previews,
        "paths": {"path": relative(paths_path), "sha256": sha(paths_path)},
        "postprocessing": postprocessing,
        "left_cut": {**lm, "mean_source_rgb_difference_255": float(np.abs(a[yy, left].astype(float) - b[yy, left]).mean())},
        "right_cut": {**rm, "mean_source_rgb_difference_255": float(np.abs(a[yy, right].astype(float) - b[yy, right]).mean())},
        "seam_before": {"wrap_adjacent_rgb_mae_255": before},
        "seam_after_master": {"wrap_adjacent_rgb_mae_255": after},
        "metrics_are_descriptive_only": True,
        "visual_acceptance": "pending manual review of wrap, transitions, objects and geometry",
        "source_unchanged": True, "api_raw_unchanged": True,
        "additional_api_calls": 0}
    for path in input_paths:
        if sha(path) != hashes[path]:
            raise RuntimeError(f"Input unexpectedly changed: {relative(path)}")
    write_json(output / "quilted.json", record)
    if not args.no_update_repair_manifests:
        original_record.setdefault("fixed_feather_candidate", original_record["finished_master"])
        original_record.update({key: record[key] for key in ("finished_master", "assets", "postprocessing",
                                                            "seam_before", "seam_after_master", "visual_acceptance")})
        original_record["quilting_record"] = relative(output / "quilted.json")
        write_json(record_path, original_record)
    emit(style=style, room=room, status="exported", seam_before=round(before, 3), seam_after=round(after, 3))
    return record


def aggregate(args):
    # Scan every saved room, including earlier exports outside this invocation's
    # selection. A one-room parameter adjustment must never truncate the index.
    records = []
    for style in STYLES:
        for room in ROOMS:
            path = args.record_root / style / room / "quilted.json"
            if path.is_file():
                record = json.loads(path.read_text(encoding="utf-8"))
                if (record.get("style"), record.get("room")) != (style, room):
                    raise ValueError(f"Incorrect room identity: {relative(path)}")
                records.append(record)
    write_json(args.manifest, {
        "schema_version": 1, "collection": "panorama-native-20261028",
        "status": "complete" if len(records) == len(STYLES) * len(ROOMS) else "partial",
        "count": len(records), "expected_count": len(STYLES) * len(ROOMS),
        "dimensions": {"desktop": [3840, 1920], "mobile": [2560, 1280], "thumbnail": [320, 160]},
        "method": "API-generated higher-resolution panoramas, masked seam edit, offline minimum-error quilting",
        "visual_acceptance": "pending manual review; per-room status is authoritative",
        "resolution_claim": "Returned API file dimensions are verified; provider internal rendering method is not established",
        "records": records})
    emit(status="manifest_written", count=len(records), path=relative(args.manifest))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--styles", nargs="+", choices=STYLES, default=list(STYLES))
    parser.add_argument("--rooms", nargs="+", choices=ROOMS, default=list(ROOMS))
    parser.add_argument("--repair-root", type=Path, default=DEFAULT_REPAIRS)
    parser.add_argument("--record-root", type=Path, help="Master/record output, default repair-root")
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts/panorama-native-20261028")
    parser.add_argument("--manifest", type=Path, default=ROOT / "home-design-review/input/panorama-native-20261028.json")
    parser.add_argument("--outer-fraction", type=float, default=.14,
                        help="Farthest cut distance / image width; .14 stays within the 30%% edit mask")
    parser.add_argument("--inner-fraction", type=float, default=.04,
                        help="Nearest cut distance / image width; default .04")
    for side in ("left", "right"):
        parser.add_argument(f"--{side}-outer-fraction", type=float)
        parser.add_argument(f"--{side}-inner-fraction", type=float)
    parser.add_argument("--feather-pixels", type=int, default=3, choices=range(0, 5))
    parser.add_argument("--workers", type=int, default=2, choices=range(1, 5))
    parser.add_argument("--no-update-repair-manifests", action="store_true", help="For isolated candidate exports")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, no writes or API calls")
    args = parser.parse_args()
    args.record_root = args.record_root or args.repair_root
    for name in ("repair_root", "record_root", "public_dir", "artifacts", "manifest"):
        setattr(args, name, getattr(args, name).resolve())
    try:
        for side in ("left", "right"):
            corridor(args, side)
    except ValueError as error:
        parser.error(str(error))
    jobs = [(style, room) for style in args.styles for room in args.rooms]
    if args.dry_run:
        emit(status="dry_run", jobs=[f"{style}/{room}" for style, room in jobs],
             repair_root=relative(args.repair_root), record_root=relative(args.record_root),
             public_dir=relative(args.public_dir), manifest=relative(args.manifest), api_calls=0)
        return
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(job, style, room, args): (style, room) for style, room in jobs}
        for future in concurrent.futures.as_completed(futures):
            style, room = futures[future]
            try:
                future.result()
            except Exception as error:
                errors.append(f"{style}/{room}: {error}")
                emit(style=style, room=room, status="failed", error=str(error))
    aggregate(args)
    if errors:
        raise SystemExit("Export failed: " + "; ".join(errors))


if __name__ == "__main__":
    main()
