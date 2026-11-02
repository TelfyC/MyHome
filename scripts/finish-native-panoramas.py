#!/usr/bin/env python3
"""Repair panorama wrap seams with one masked CLI edit, then export web assets.

Original native API images are immutable. Rolled inputs, masks, raw seam API
outputs and feathered composites are separate artifacts. Composite masters and
JPEGs are explicitly postprocessed images, never unmodified native API outputs.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STYLES = ("forest", "japanese", "french", "sunlit")
ROOMS = ("living", "dining", "master", "study", "guest", "kitchen", "bathroom")
SIZE = (3840, 1920)
MOBILE_SIZE = (2560, 1280)
RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS
DEFAULT_CLI = Path("/home/juntao.ji@formal-tech.group/.codex-openai/skills/.system/imagegen/scripts/image_gen.py")
PILOT = ROOT / "output/imagegen/native-panorama-pilot-20261028/forest-living-native-3840x1920.png"
PRINT_LOCK = threading.Lock()


def emit(**record):
    with PRINT_LOCK:
        print(json.dumps(record, ensure_ascii=False), flush=True)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def write_json(path: Path, value):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def describe(path: Path) -> dict:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        dimensions = list(image.size)
        image_format = image.format
    return {"path": relative(path), "dimensions": dimensions, "format": image_format,
            "bytes": path.stat().st_size, "sha256": sha(path)}


def rgb(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        if image.size != SIZE or image.format != "PNG":
            raise ValueError(f"Expected untouched 3840x1920 PNG: {relative(path)}; got {image.size}, {image.format}")
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def seam_metrics(pixels: np.ndarray) -> dict:
    band = pixels[round(len(pixels) * .1):round(len(pixels) * .9)].astype(np.float32)
    interior = np.abs(np.diff(band, axis=1)).mean(axis=2)
    return {"latitude_band": [.1, .9],
            "wrap_adjacent_rgb_mae_255": round(float(np.abs(band[:, -1] - band[:, 0]).mean()), 4),
            "interior_adjacent_rgb_mae_255": round(float(interior.mean()), 4),
            "interior_adjacent_p95_255": round(float(np.percentile(interior, 95)), 4),
            "interpretation": "Descriptive only; not automatic visual acceptance"}


def repair_prompt(mask_width: int, core_width: int, preserve_note: str = "") -> str:
    text = f"""Use case: precise-object-edit.
Asset: the SAME full 360 x 180 degree equirectangular interior panorama, exact 3840 x 1920.
The input has been horizontally rotated by exactly half its width. Its former left/right wrap seam is NOW THE VERTICAL CENTER at x=1920. The transparent alpha mask marks ONLY a central {mask_width}-pixel-wide strip. This is a localized seam repair, not a redesign or global enhancement.

Repair the abrupt center join so the room reads as one continuous physical scene across this strip. Use unmasked context on BOTH sides. Resolve broken or repeated window-frame and curtain fragments into the SAME coherent existing window assembly; continue wall, lighting, floor/rug texture and plant leaves naturally across the center. Remove truncated duplicate fragments only where needed for this local join. Keep the existing room dimensions, camera center, orientation, objects, materials, exposure and colors. Do not add doors, windows, rooms, furniture, lamps or new plants, and do not expand the window or change the layout.

Preserve every existing lamp, side table, stool, pot and plant. If an object is cut by the old center join, reconstruct its missing part and coherent complete silhouette; do NOT erase it, replace it with a different object, or double it. Keep the current window head and sill heights, frame alignment and curtains; do NOT turn a window into a door or extend glazing toward the floor. Existing complete objects and their placements remain the authoritative design.

Continue existing ceiling texture at the top and existing floor/rug at the bottom, retaining their equirectangular polar distortion. Keep full 2:1 spherical projection. Do not turn the image into an ordinary perspective photograph. The middle {core_width}-pixel core must be a fully continuous repair. Reconcile whole object silhouettes WITHIN this core rather than clipping a reconstruction halfway through a window, lamp or stool. Near each mask boundary, precisely align existing outlines, curtain folds, furniture edges and exposure to the input; do not move or redraw them. The narrow outer margins are blending anchors, not space for a different design. No vertical line, sudden exposure change, ghost/double contour, duplicated leaf/window edge, blur stripe, text or watermark. Everything outside the mask must remain visually unchanged.
"""
    if preserve_note.strip():
        text += "\nAdditional image-specific preservation requirement:\n" + preserve_note.strip() + "\n"
    return text


def widths(args):
    # Whole even widths make the original longitude seam an exact center boundary.
    editable = int(math.ceil(SIZE[0] * args.band_fraction / 32) * 32)
    core = int(math.floor(SIZE[0] * args.core_fraction / 32) * 32)
    if not 0 < core < editable < SIZE[0]:
        raise ValueError("Repair core must be positive and narrower than editable strip")
    return editable, core


def secure_environment(args):
    key_path = Path(args.key_file).expanduser()
    try:
        key = key_path.read_text(encoding="utf-8").strip()
    except OSError:
        raise ValueError("Cannot read independent image API key file") from None
    if not key or any(character.isspace() for character in key):
        raise ValueError("Image API key file must contain one nonempty key and no embedded whitespace")
    env = os.environ.copy()
    for name in ("OPENAI_ORG_ID", "OPENAI_PROJECT_ID", "OPENAI_ADMIN_KEY", "OPENAI_CUSTOM_HEADERS", "OPENAI_LOG", "OPENAI_API_BASE"):
        env.pop(name, None)
    env["OPENAI_API_KEY"] = key
    env["OPENAI_BASE_URL"] = args.base_url
    dependencies = Path("/tmp/home3D-native-panorama-deps")
    if (dependencies / "openai").is_dir():
        env["PYTHONPATH"] = str(dependencies) + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    return env, key


def redact(text: str, key: str) -> str:
    if key:
        text = text.replace(key, "[REDACTED_API_KEY]")
    return re.sub(r"sk-[A-Za-z0-9_.-]+", "[REDACTED_API_KEY]", text)


def run_cli(command, args, log: Path, dry_run: bool):
    key = ""
    env = os.environ.copy()
    if dry_run:
        for name in ("OPENAI_API_KEY", "OPENAI_ADMIN_KEY", "OPENAI_CUSTOM_HEADERS", "OPENAI_LOG"):
            env.pop(name, None)
    else:
        env, key = secure_environment(args)
    try:
        result = subprocess.run(command, cwd=ROOT, env=env, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                timeout=args.timeout, check=False)
        log.write_text(redact(result.stdout, key), encoding="utf-8")
    except subprocess.TimeoutExpired as error:
        captured = error.stdout or ""
        if isinstance(captured, bytes):
            captured = captured.decode("utf-8", errors="replace")
        log.write_text(redact(captured, key) + "\nProcess timed out; request outcome may be uncertain.\n", encoding="utf-8")
        raise RuntimeError("Seam CLI timed out; do not automatically repeat a possibly charged request") from None
    if result.returncode:
        raise RuntimeError(f"Seam CLI failed (exit {result.returncode}); see {relative(log)}")


def save_jpeg(image: Image.Image, path: Path):
    temporary = path.with_name(path.name + ".tmp")
    image.save(temporary, format="JPEG", quality=94, subsampling=0, optimize=True, progressive=True)
    temporary.replace(path)


def cached_complete(record: dict) -> bool:
    paths = [record.get("finished_master", {})] + record.get("assets", [])
    return bool(paths) and all(item.get("path") and (ROOT / item["path"]).is_file()
                               and sha(ROOT / item["path"]) == item.get("sha256") for item in paths)


def finish_job(style, room, args):
    requested = args.source_root / style / f"{room}-native.png"
    source = Path(args.source_file).resolve() if args.source_file else requested
    reused_pilot = False
    if not source.is_file() and style == "forest" and room == "living" and not args.source_file and PILOT.is_file():
        source, reused_pilot = PILOT, True
    if not source.is_file():
        raise FileNotFoundError(f"Native input not yet available: {relative(source)}")
    native = rgb(source)
    source_hash = sha(source)
    band, core = widths(args)
    preserve_note = getattr(args, "preserve_note", "")
    if not preserve_note and style == "forest" and room == "living":
        preserve_note = ("Keep the existing cylindrical fabric table lamp on its wooden stump base in front of the window, "
                         "and the woven stool beside it. Preserve the original sill height and window opening size.")
    prompt = repair_prompt(band, core, preserve_note)
    signature = {"source_sha256": source_hash, "size": list(SIZE), "mask_width": band,
                 "core_width": core, "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                 "model": args.model, "base_url": args.base_url,
                 "output_root": str(args.output_root), "mobile_size": list(MOBILE_SIZE)}
    directory = args.artifacts / style / room
    directory.mkdir(parents=True, exist_ok=True)
    state_path, record_path = directory / "state.json", directory / "manifest.json"
    rolled_path, mask_path = directory / "rolled-input.png", directory / "mask.png"
    prompt_path, raw_path = directory / "prompt.txt", directory / "repair-raw.png"
    final_path = directory / "finished-composite.png"
    state = json.loads(state_path.read_text()) if state_path.is_file() else {}
    if state and state.get("signature") != signature:
        raise RuntimeError(f"Existing seam artifacts belong to another source/configuration: {relative(directory)}")
    if state.get("status") == "complete" and record_path.is_file():
        record = json.loads(record_path.read_text())
        if cached_complete(record) and raw_path.is_file() and sha(raw_path) == record["repair_api_raw"]["sha256"]:
            emit(style=style, room=room, status="reused_complete")
            return record

    center = SIZE[0] // 2
    rolled = np.roll(native, center, axis=1)
    positions = np.abs(np.arange(SIZE[0], dtype=np.float32) + .5 - center)
    editable = positions < band / 2
    blend = np.clip((positions - core / 2) / ((band - core) / 2), 0, 1)
    blend = (.5 + .5 * np.cos(np.pi * blend)).astype(np.float32)
    blend[~editable] = 0
    if not state:
        Image.fromarray(rolled).save(rolled_path, compress_level=3)
        mask = np.full((SIZE[1], SIZE[0], 4), 255, dtype=np.uint8)
        mask[:, editable, 3] = 0
        Image.fromarray(mask, "RGBA").save(mask_path, compress_level=3)
        prompt_path.write_text(prompt, encoding="utf-8")
        state = {"signature": signature, "status": "prepared", "logical_api_attempts": 0}
        write_json(state_path, state)
    for path in (rolled_path, mask_path, prompt_path):
        if not path.is_file():
            raise RuntimeError(f"Prepared seam artifact missing: {relative(path)}")

    command = [sys.executable, str(args.cli), "edit", "--model", args.model,
               "--image", str(rolled_path), "--mask", str(mask_path),
               "--prompt-file", str(prompt_path), "--no-augment", "--size", "3840x1920",
               "--quality", "high", "--output-format", "png", "--n", "1", "--out", str(raw_path)]
    if args.dry_run:
        run_cli(command + ["--dry-run"], args, directory / "request-dry-run.log", True)
        emit(style=style, room=room, status="prepared_dry_run", directory=relative(directory))
        return {"style": style, "room": room, "status": "prepared_dry_run", "directory": relative(directory)}
    if not raw_path.is_file():
        if state.get("status") in ("started", "failed") and not args.retry_failed:
            raise RuntimeError(f"Previous seam request failed or has uncertain outcome; automatic retry blocked: {style}/{room}. Use --retry-failed only after reviewing its log.")
        # Fail missing credentials before recording a possibly charged attempt.
        secure_environment(args)
        state.update(status="started", logical_api_attempts=state.get("logical_api_attempts", 0) + 1,
                     started_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        write_json(state_path, state)
        log = directory / f"api-attempt-{state['logical_api_attempts']}.log"
        emit(style=style, room=room, status="seam_api_started", logical_attempt=state["logical_api_attempts"])
        try:
            run_cli(command, args, log, False)
            rgb(raw_path)
        except Exception as error:
            state.update(status="failed", error=str(error))
            write_json(state_path, state)
            raise
        state.update(status="api_complete")
        write_json(state_path, state)

    repaired = rgb(raw_path)
    weights = blend[None, :, None]
    composite = np.rint(rolled.astype(np.float32) * (1 - weights) + repaired.astype(np.float32) * weights).astype(np.uint8)
    if not np.array_equal(composite[:, ~editable], rolled[:, ~editable]):
        raise RuntimeError("Composite unexpectedly modified pixels outside the editable mask")
    final = np.roll(composite, -center, axis=1)
    if not (np.array_equal(final[:, 0], repaired[:, center]) and
            np.array_equal(final[:, -1], repaired[:, center - 1])):
        raise RuntimeError("Final longitude boundary did not come from adjacent repaired center pixels")
    if sha(source) != source_hash:
        raise RuntimeError("Original native input changed during seam processing")
    Image.fromarray(final).save(final_path, compress_level=3)
    output = args.output_root / style
    output.mkdir(parents=True, exist_ok=True)
    master = Image.fromarray(final)
    assets = []
    for kind, image, name in [("desktop", master, f"{room}.jpg"),
                              ("mobile", master.resize(MOBILE_SIZE, RESAMPLE), f"{room}-mobile.jpg"),
                              ("thumbnail", master.resize((320, 160), RESAMPLE), f"{room}-thumb.jpg")]:
        path = output / name
        save_jpeg(image, path)
        assets.append({"kind": kind, **describe(path)})
    record = {
        "style": style, "room": room, "status": "complete", "source": describe(source),
        "reused_pilot_source": reused_pilot, "repair_api_raw": describe(raw_path),
        "rolled_input": describe(rolled_path), "mask": describe(mask_path),
        "prompt": relative(prompt_path), "finished_master": describe(final_path), "assets": assets,
        "api": {"provider_base_url": args.base_url, "model": args.model, "endpoint": "/v1/images/edits",
                "size": list(SIZE), "quality": "high", "n": 1,
                "logical_seam_calls": state.get("logical_api_attempts", 0),
                "outer_automatic_retries": 0,
                "sdk_retry_policy": "Installed CLI uses OpenAI() default SDK retries (currently 2); no constructor modification"},
        "postprocessing": {"kind": "masked AI seam repair plus local feathered composite; not raw native API output",
                           "horizontal_roll_pixels": center, "editable_strip_width": band,
                           "full_replacement_core_width": core, "feather": "cosine across each side of core",
                           "feather_limitation": "Cannot correct misaligned object silhouettes; inspect both strip transitions for ghosting",
                           "mask_latitude_extent": "full height; prompt preserves ceiling/floor spherical distortion",
                           "pixels_outside_editable_mask": "bit-exact to original native input in composite master",
                           "final_wrap_boundary": "adjacent pixels from repaired center; no edge blur/duplicate blending",
                           "jpeg": {"quality": 94, "subsampling": 0, "progressive": True}},
        "seam_before": seam_metrics(native), "seam_after_master": seam_metrics(final),
        "visual_acceptance": "pending manual inspection of window/plant continuity, geometry and repaired-strip transitions",
        "source_unchanged": True,
    }
    write_json(record_path, record)
    state.update(status="complete", completed_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    write_json(state_path, state)
    emit(style=style, room=room, status="complete", seam_before=record["seam_before"]["wrap_adjacent_rgb_mae_255"],
         seam_after=record["seam_after_master"]["wrap_adjacent_rgb_mae_255"])
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--styles", nargs="+", choices=STYLES, default=list(STYLES))
    parser.add_argument("--rooms", nargs="+", choices=ROOMS, default=list(ROOMS))
    parser.add_argument("--source-root", type=Path, default=ROOT / "output/imagegen/panoramas-native-20261028")
    parser.add_argument("--source-file", type=Path, help="Single-job input override; original is never changed")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "output/imagegen/panoramas-native-20261028/seam-repair")
    parser.add_argument("--output-root", type=Path, default=ROOT / "public/panoramas-native")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--band-fraction", type=float, default=.30,
                        help="Editable longitude fraction, .10..40; choose boundaries outside complete objects (default .30)")
    parser.add_argument("--core-fraction", type=float, default=.26,
                        help="Fully replaced central fraction; keep whole reconstructed objects inside (default .26)")
    parser.add_argument("--preserve-note", default="",
                        help="Additional image-specific object/geometry preservation requirement, recorded in prompt")
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--base-url", default=os.environ.get("HOME3D_IMAGE_API_BASE_URL", "https://api.oaipro.com/v1"))
    parser.add_argument("--key-file", default=os.environ.get("HOME3D_IMAGE_API_KEY_FILE", "~/.config/home3d/openai-api-key"))
    parser.add_argument("--cli", type=Path, default=DEFAULT_CLI)
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--dry-run", action="store_true", help="Prepare roll/mask/prompt and CLI preview; no key read or API call")
    parser.add_argument("--retry-failed", action="store_true", help="Explicitly permit another possibly charged call after failed/uncertain prior request")
    args = parser.parse_args()
    if not 1 <= args.workers <= 8 or not .10 <= args.band_fraction <= .40 or not 0 < args.core_fraction < args.band_fraction:
        parser.error("workers must be 1..8, editable band .10..40, and 0 < core < band")
    if args.timeout < 30:
        parser.error("timeout must be at least 30 seconds")
    url = urlsplit(args.base_url)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error("base-url must be a plain HTTPS endpoint without credentials/query/fragment")
    if args.source_file and len(args.styles) * len(args.rooms) != 1:
        parser.error("source-file requires exactly one style and one room")
    if not args.cli.is_file():
        parser.error("Bundled image CLI not found")
    for name in ("source_root", "artifacts", "output_root", "cli"):
        setattr(args, name, getattr(args, name).resolve())
    args.artifacts.mkdir(parents=True, exist_ok=True)
    records, errors = [], []
    jobs = list(dict.fromkeys((style, room) for style in args.styles for room in args.rooms))
    def save_manifest():
        write_json(args.artifacts / ("dry-run-manifest.json" if args.dry_run else "manifest.json"),
                   {"method": "masked seam repair; originals retained; outputs are postprocessed composites",
                    "dry_run": args.dry_run, "requested": len(jobs), "completed": len(records),
                    "records": sorted(records, key=lambda item: (STYLES.index(item["style"]), ROOMS.index(item["room"]))),
                    "errors": errors, "visual_acceptance": "manual review required; metrics are descriptive"})
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        pending = {executor.submit(finish_job, style, room, args): (style, room) for style, room in jobs}
        for future in concurrent.futures.as_completed(pending):
            style, room = pending[future]
            try:
                records.append(future.result())
            except Exception as error:
                failure = {"style": style, "room": room, "error": str(error)}
                errors.append(failure)
                emit(status="error", **failure)
            save_manifest()
    emit(status="finished", completed=len(records), errors=len(errors), requested=len(jobs), dry_run=args.dry_run)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
