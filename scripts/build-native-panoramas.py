#!/usr/bin/env python3
"""Generate 4K panorama masters with the existing imagegen skill CLI.

This is an orchestration layer, not an SDK/API implementation. Originals are
read-only. Each room makes at most one CLI edit invocation per run; the SDK
inside that CLI may itself retry transient transport errors.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STYLES = ("forest", "japanese", "french", "sunlit")
ROOMS = ("living", "dining", "master", "study", "guest", "kitchen", "bathroom")
SIZE = (3840, 1920)
DEFAULT_CLI = (Path.home() / ".codex-openai/skills/.system/imagegen/scripts/image_gen.py")
DEFAULT_OUTPUT = ROOT / "output/imagegen/panoramas-native-20261028"
PILOT = ROOT / "output/imagegen/native-panorama-pilot-20261028"
WRITE_LOCK = threading.Lock()
STOP = threading.Event()

STYLE_NOTES = {
    "forest": "woodland retreat: preserve the image's sage/lichen greens, dark cherry wood, natural oak, linen and plants",
    "japanese": "Japanese mid-century: preserve the image's walnut/teak timber, warm neutral and muted olive palette, restrained details and light",
    "french": "light French vintage timber: preserve the image's pale wood, ivory, muted accent colors, delicate metal details and soft lighting",
    "sunlit": "sunlit garden timber: preserve the image's light wood, white surfaces, green accents, textiles and natural daylight",
}
ROOM_NOTES = {
    "living": "Keep the existing television and console opposite the sofa, exterior windows, original doors and the visible dining/kitchen relationships exactly as shown.",
    "dining": "Keep the existing dining table, bench/chairs, coffee cabinet, original balcony/window boundary, and the visible kitchen/circulation exactly as shown.",
    "master": "Keep the existing main bed, bedside furniture, wardrobe/storage, original exterior window and entrance positions exactly as shown.",
    "study": "Keep the existing gaming/work desk, computer and monitor arrangement, chair, shelves, cable/storage locations, solid walls and original window exactly as shown.",
    "guest": "Keep the approved single-person arrangement: daybed on the left and long desk on the right, existing shelving, wardrobe, original window and clear central aisle. Do not introduce a centered double bed or any new side window.",
    "kitchen": "Keep the gas hob/hood, sink, preparation counters, refrigerator and storage in their exact existing positions. Preserve all existing transparent top-hung glass door leaves and their current open/stacked positions. Do not add an island, floor track or corner post.",
    "bathroom": "Keep the existing basin, washing machine/counter, toilet, shower, storage, opaque entrance door and wet/dry separation in their exact positions. Do not introduce extra fixtures, windows or transparent interior doors.",
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def emit(data: dict) -> None:
    with WRITE_LOCK:
        print(json.dumps(data, ensure_ascii=False), flush=True)


def inspect_image(path: Path) -> dict:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        dimensions, image_format = list(image.size), image.format
    return {"path": relative(path), "dimensions": dimensions, "format": image_format,
            "bytes": path.stat().st_size, "sha256": digest(path)}


def prompt_for(style: str, room: str) -> str:
    return f"""Use case: precise-object-edit.
Asset type: full 360 degree x 180 degree equirectangular interior panorama, exact 2:1, for an interactive spherical viewer.
Input image 1 is the edit target and authoritative reference for the SAME existing {room} room, its design, camera, orientation and architecture.

Primary request: make the same panorama photographically clearer at the requested 3840 x 1920 output resolution. Preserve the approved design. This is a detail reconstruction, NOT a redesign or new room proposal.
Style reference: {STYLE_NOTES[style]}. The source image's actual colors, materials and objects take priority over any generic style description.
Room invariants: {ROOM_NOTES[room]}
Keep every existing wall, original exterior window, black window frame, doorway and adjacent room connection. Keep the existing curtains, sheers, curtain rails and their actual colors. Interior frosted-glass doors stay opaque; existing clear kitchen glass stays clear. Keep all furniture and objects in their original places, proportions and quantities, including plants, lighting, controls, ornaments and books. Do not add openings, furniture, people, text, logos or watermarks.

Improve only credible fine material detail: clear but restrained wood grain and cabinet joints, real fabric weave, curtain folds, coherent existing knitted stitches, believable rug fibers, small hardware edges and subtle matte wall texture. Plain fabrics must remain plain: no new ornamental patterns, embossed motifs, fake relief or texture that changes the material identity. Keep existing patterned fabric motifs and their scale. Preserve natural light direction, exposure, neutral color balance and small local warm lamps. Avoid yellow color casts, artificial HDR, aggressive sharpening halos, smeared surfaces and invented noise.

Projection invariants: keep exactly the same camera center, horizon, longitude orientation and FULL spherical coverage, including ceiling and floor polar distortion. Output a true equirectangular longitude/latitude image, not an ordinary wide-angle photo, cropped view, cylinder, collage or contact sheet. LEFT AND RIGHT EDGES ARE ADJACENT DIRECTIONS: geometry, light and material patterns must continue coherently across longitude wrap; do not insert a duplicate mirrored room, duplicated window or abrupt joining line. Keep all other geometry and scene relationships faithful to the source.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--styles", nargs="+", choices=STYLES, default=list(STYLES))
    parser.add_argument("--rooms", nargs="+", choices=ROOMS, default=list(ROOMS))
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--source-root", type=Path, default=ROOT / "public/panoramas")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-url", default="https://api.oaipro.com/v1")
    parser.add_argument("--key-file", type=Path, default=Path.home() / ".config/home3d/openai-api-key")
    parser.add_argument("--cli", type=Path, default=DEFAULT_CLI)
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--dry-run", action="store_true", help="Print a local plan; no keys read, output files written or API calls")
    parser.add_argument("--skip-existing", action="store_true", help="Resume only intact matching outputs; never overwrite")
    parser.add_argument("--retry-failed", action="store_true", help="Explicitly allow another invocation after a prior failed/no-output attempt")
    parser.add_argument("--no-reuse-pilot", action="store_true")
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 4:
        parser.error("workers must be between 1 and 4")
    url = urlsplit(args.base_url)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error("base-url must be an HTTPS API base URL without credentials, query or fragment")
    if not args.cli.is_file():
        parser.error("The existing imagegen skill CLI was not found")
    args.source_root = args.source_root.resolve()
    args.output_root = args.output_root.resolve()
    if args.output_root == args.source_root or args.source_root in args.output_root.parents:
        parser.error("output-root must be separate from source-root")
    jobs = [(style, room) for style in dict.fromkeys(args.styles) for room in dict.fromkeys(args.rooms)]
    for style, room in jobs:
        source = args.source_root / style / f"{room}.jpg"
        if not source.is_file():
            parser.error(f"Missing source: {source}")
        with Image.open(source) as image:
            if image.width != image.height * 2:
                parser.error(f"Expected a 2:1 source: {source}")
    request = {"api_base_url": args.base_url.rstrip("/"), "endpoint": "/images/edits",
               "model": args.model, "size": list(SIZE), "quality": "high", "n": 1,
               "output_format": "png", "local_resizing": False,
               "orchestrator_retries": 0, "sdk_transient_transport_retries_possible": True}
    if args.dry_run:
        emit({"dry_run": True, "keys_read": False, "api_calls": 0,
              "workers": args.workers, "request": request,
              "jobs": [{"style": style, "room": room,
                        "source": relative(args.source_root / style / f"{room}.jpg"),
                        "output": relative(args.output_root / style / f"{room}-native.png"),
                        "source_sha256": digest(args.source_root / style / f"{room}.jpg"),
                        "prompt": prompt_for(style, room)} for style, room in jobs]})
        return 0
    if not args.key_file.is_file():
        parser.error("Independent API key file is missing")
    secret = args.key_file.read_text(encoding="utf-8").strip()
    if not secret or any(character.isspace() for character in secret):
        parser.error("Independent API key file is empty or contains whitespace")
    environment = dict(os.environ)
    for name in ("OPENAI_ORG_ID", "OPENAI_PROJECT_ID", "OPENAI_ADMIN_KEY", "OPENAI_CUSTOM_HEADERS", "OPENAI_LOG"):
        environment.pop(name, None)
    environment["OPENAI_API_KEY"] = secret
    environment["OPENAI_BASE_URL"] = request["api_base_url"]
    sdk = Path("/tmp/home3D-native-panorama-deps")
    if (sdk / "openai").is_dir():
        environment["PYTHONPATH"] = str(sdk) + (os.pathsep + environment["PYTHONPATH"] if environment.get("PYTHONPATH") else "")

    def redact(message: str) -> str:
        return re.sub(r"sk-[A-Za-z0-9_.-]+", "[REDACTED_API_KEY]", message.replace(secret, "[REDACTED_API_KEY]"))

    records: dict[str, dict] = {}
    started = now()
    args.output_root.mkdir(parents=True, exist_ok=True)

    def record_result(record: dict) -> None:
        with WRITE_LOCK:
            records[f"{record['style']}/{record['room']}"] = record
            write_json(args.output_root / "manifest.json", {
                "started_at": started, "updated_at": now(), "request": request,
                "jobs_requested": len(jobs), "jobs_recorded": len(records),
                "records": [records[key] for key in sorted(records)],
                "scope": "4K generation masters only; seam and visual acceptance are separate",
            })

    def process(job: tuple[str, str]) -> dict:
        style, room = job
        source = args.source_root / style / f"{room}.jpg"
        directory = args.output_root / style
        output = directory / f"{room}-native.png"
        metadata = output.with_suffix(".json")
        prompt_path = directory / f"{room}-native-prompt.txt"
        log_path = directory / f"{room}-native.log"
        source_info = inspect_image(source)
        prompt = prompt_for(style, room)
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        base = {"style": style, "room": room, "source": source_info,
                "request": request, "prompt_sha256": prompt_hash,
                "prompt_path": relative(prompt_path), "output_path": relative(output),
                "sdk_cli": str(args.cli), "updated_at": now(),
                "visual_acceptance": "pending", "seam_acceptance": "pending"}
        previous = None
        output_preexisted = output.exists()
        timer = None
        try:
            if metadata.is_file():
                previous = json.loads(metadata.read_text(encoding="utf-8"))
            if output.exists():
                if not args.skip_existing:
                    raise RuntimeError("Output exists; no API call made. Use --skip-existing to verify and resume.")
                if not previous or previous.get("source", {}).get("sha256") != source_info["sha256"]:
                    raise RuntimeError("Existing output has no matching source provenance; refusing overwrite or API call.")
                if previous.get("request") != request:
                    raise RuntimeError("Existing output request parameters differ; refusing overwrite or API call.")
                info = inspect_image(output)
                if info["dimensions"] != list(SIZE) or info["format"] != "PNG":
                    raise RuntimeError("Existing output is not an intact 3840x1920 PNG; refusing overwrite.")
                if previous.get("output", {}).get("sha256") not in (None, info["sha256"]):
                    raise RuntimeError("Existing output hash differs from its provenance; refusing reuse.")
                if previous.get("prompt_sha256") != prompt_hash and not previous.get("reused_pilot"):
                    raise RuntimeError("Existing output prompt differs; refusing implicit regeneration.")
                reused = dict(previous)
                reused.update(status="skipped_verified", output=info, updated_at=now())
                write_json(metadata, reused)
                return reused
            if previous and previous.get("status") in ("request_started", "failed") and not args.retry_failed:
                raise RuntimeError("Prior API attempt has no output. Review its log, then use --retry-failed for an explicit retry.")
            if STOP.is_set():
                return {**base, "status": "blocked_before_request", "error": "Another room reported a shared authentication/credit error; no API call made."}
            directory.mkdir(parents=True, exist_ok=True)
            if style == "forest" and room == "living" and not args.no_reuse_pilot:
                pilot_meta = PILOT / "result.json"
                pilot_output = PILOT / "forest-living-native-3840x1920.png"
                pilot_prompt = PILOT / "prompt.txt"
                if pilot_meta.is_file() and pilot_output.is_file() and pilot_prompt.is_file():
                    candidate = json.loads(pilot_meta.read_text(encoding="utf-8"))
                    candidate_info = inspect_image(pilot_output)
                    if (candidate.get("source", {}).get("sha256") == source_info["sha256"]
                            and candidate.get("requested_model") == args.model
                            and candidate.get("api_base_url") == request["api_base_url"]
                            and candidate.get("requested_size") == list(SIZE)
                            and candidate.get("output", {}).get("sha256") == candidate_info["sha256"]
                            and candidate_info["dimensions"] == list(SIZE)):
                        prompt_path.write_text(pilot_prompt.read_text(encoding="utf-8"), encoding="utf-8")
                        base["prompt_sha256"] = digest(prompt_path)
                        shutil.copy2(pilot_output, output)
                        record = {**base, "status": "reused_pilot", "reused_pilot": relative(pilot_meta),
                                  "output": inspect_image(output), "cli_invocations": 0,
                                  "seconds": 0, "updated_at": now()}
                        write_json(metadata, record)
                        return record
            prompt_path.write_text(prompt, encoding="utf-8")
            command = [sys.executable, str(args.cli), "edit", "--model", args.model,
                       "--image", str(source), "--prompt-file", str(prompt_path),
                       "--no-augment", "--size", "3840x1920", "--quality", "high",
                       "--output-format", "png", "--n", "1", "--out", str(output)]
            running = {**base, "status": "request_started", "cli_invocations": 1,
                       "log_path": relative(log_path), "started_at": now()}
            write_json(metadata, running)
            emit({"event": "request_started", "style": style, "room": room})
            timer = time.monotonic()
            tail = []
            with log_path.open("w", encoding="utf-8") as log:
                with subprocess.Popen(command, cwd=ROOT, env=environment, stdout=subprocess.PIPE,
                                      stderr=subprocess.STDOUT, text=True, errors="replace", bufsize=1) as child:
                    assert child.stdout is not None
                    for line in child.stdout:
                        clean = redact(line)
                        log.write(clean)
                        log.flush()
                        tail.append(clean.rstrip())
                        tail = tail[-12:]
                    code = child.wait()
            elapsed = round(time.monotonic() - timer, 2)
            if code:
                message = "\n".join(tail)[-3000:]
                lower = message.lower()
                if any(term in lower for term in ("no credits", "insufficient_quota", "invalid api key", "incorrect api key", "authenticationerror")):
                    STOP.set()
                raise RuntimeError(f"Skill CLI exited {code} after {elapsed}s: {message}")
            info = inspect_image(output)
            if info["dimensions"] != list(SIZE) or info["format"] != "PNG":
                raise RuntimeError(f"API output was {info['dimensions']} / {info['format']}, not the requested 3840x1920 PNG; no resizing performed.")
            if digest(source) != source_info["sha256"]:
                raise RuntimeError("Source changed during API generation; output retained but not accepted for this source.")
            record = {**running, "status": "generated", "output": info,
                      "seconds": elapsed, "updated_at": now()}
            write_json(metadata, record)
            return record
        except Exception as error:
            record = {**base, "status": "failed", "error": redact(str(error)), "updated_at": now(),
                      "cli_invocations": int(timer is not None),
                      "seconds": round(time.monotonic() - timer, 2) if timer is not None else 0}
            # Preserve successful provenance when a resume check fails.
            if not output_preexisted:
                directory.mkdir(parents=True, exist_ok=True)
                write_json(metadata, record)
            return record

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process, job): job for job in jobs}
        for future in concurrent.futures.as_completed(futures):
            style, room = futures[future]
            try:
                record = future.result()
            except Exception as error:
                record = {"style": style, "room": room, "status": "failed", "error": redact(str(error)), "updated_at": now()}
            record_result(record)
            emit({"event": "room_finished", "style": style, "room": room,
                  "status": record["status"], "finished": len(records), "total": len(jobs),
                  **({"error": record["error"]} if record.get("error") else {})})
    failed = [record for record in records.values() if record["status"] in ("failed", "blocked_before_request")]
    emit({"event": "batch_finished", "succeeded": len(records) - len(failed),
          "failed": len(failed), "manifest": relative(args.output_root / "manifest.json")})
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
