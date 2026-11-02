#!/usr/bin/env python3
"""Offline minimum-error seam quilting of existing panorama API outputs.

Uses two monotone dynamic-programming cuts, not a general graph-cut solver.
Writes separate candidates/reviews only; never changes API inputs or web assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "output/imagegen/panoramas-native-20261028/seam-repair-wide/forest/living"
RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    with Image.open(path) as image:
        if image.size != (3840, 1920):
            raise ValueError(f"Expected 3840x1920 input, got {image.size}: {path}")
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def find_cut(a, b, start, end, gradient_weight, edge_weight, step_penalty):
    """Minimum top-to-bottom error path with moves -1, 0 or +1 per row."""
    # Include one extra column around the corridor for central differences.
    lo, hi = max(0, start - 1), min(a.shape[1], end + 1)
    aa, bb = a[:, lo:hi].astype(np.float32), b[:, lo:hi].astype(np.float32)
    color = np.abs(aa - bb).mean(axis=2)
    ga, gb = aa.mean(axis=2), bb.mean(axis=2)
    ay, ax = np.gradient(ga)
    by, bx = np.gradient(gb)
    gradient = np.abs(ax - bx) + np.abs(ay - by)
    # The weak shared-edge term discourages cutting through a strong contour
    # even if the input and repair happen to share that exact edge location.
    edges = np.minimum(np.hypot(ax, ay), np.hypot(bx, by))
    cost = (color + gradient_weight * gradient + edge_weight * edges)[:, start - lo:end - lo]
    height, width = cost.shape
    back = np.zeros((height, width), dtype=np.int8)
    previous = cost[0].copy()
    for y in range(1, height):
        left = np.empty(width, dtype=np.float32)
        right = np.empty(width, dtype=np.float32)
        left[0], left[1:] = np.inf, previous[:-1] + step_penalty
        right[-1], right[:-1] = np.inf, previous[1:] + step_penalty
        choices = np.stack((left, previous, right))
        selected = np.argmin(choices, axis=0)
        back[y] = selected.astype(np.int8) - 1
        previous = cost[y] + np.take_along_axis(choices, selected[None], axis=0)[0]
    path = np.empty(height, dtype=np.int32)
    path[-1] = int(np.argmin(previous))
    for y in range(height - 1, 0, -1):
        path[y - 1] = path[y] + back[y, path[y]]
    local_cost = cost[np.arange(height), path]
    path += start
    return path, {"search_x": [start, end], "selected_mean_color_gradient_cost": float(local_cost.mean()),
                  "path_min_x": int(path.min()), "path_median_x": float(np.median(path)),
                  "path_max_x": int(path.max())}


def weights(width, left, right, feather):
    x = np.arange(width, dtype=np.float32)[None, :]
    if feather == 0:
        return ((x >= left[:, None]) & (x < right[:, None])).astype(np.float32)
    # A total 3 px transition (default), rather than an 80 px ghosting band.
    l = np.clip((x - left[:, None] + .5) / feather + .5, 0, 1)
    r = np.clip((right[:, None] - x - .5) / feather + .5, 0, 1)
    l, r = l * l * (3 - 2 * l), r * r * (3 - 2 * r)
    return l * r


def project(array, yaw, pitch=-.1, fov=86, width=1000, height=650):
    tangent = math.tan(math.radians(fov) / 2) / (width / height)
    x = ((np.arange(width, dtype=np.float32) + .5) / width * 2 - 1) * tangent * width / height
    y = (1 - (np.arange(height, dtype=np.float32) + .5) / height * 2) * tangent
    xx, yy = np.meshgrid(x, y)
    f = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)], dtype=np.float32)
    r = np.array([math.cos(yaw), 0, math.sin(yaw)], dtype=np.float32)
    up = np.cross(r, f)
    ray = f + xx[..., None] * r + yy[..., None] * up
    ray /= np.linalg.norm(ray, axis=2, keepdims=True)
    u = np.mod(np.arctan2(-ray[..., 0], ray[..., 2]) / (2 * math.pi), 1)
    v = .5 - np.arcsin(np.clip(ray[..., 1], -1, 1)) / math.pi
    h, w = array.shape[:2]
    sx, sy = u * w - .5, np.clip(v * h - .5, 0, h - 1)
    x0, y0 = np.floor(sx).astype(np.int32), np.floor(sy).astype(np.int32)
    tx, ty = (sx - x0)[..., None], (sy - y0)[..., None]
    x1, y1 = (x0 + 1) % w, np.minimum(y0 + 1, h - 1)
    x0 %= w
    upper = array[y0, x0] * (1 - tx) + array[y0, x1] * tx
    lower = array[y1, x0] * (1 - tx) + array[y1, x1] * tx
    return Image.fromarray(np.rint(upper * (1 - ty) + lower * ty).astype(np.uint8))


def font(size):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size) if path.is_file() else ImageFont.load_default()


def review(arrays, labels, title, yaw, output, fov=86):
    views = [project(array, yaw, fov=fov) for array in arrays]
    width, height = views[0].size
    canvas = Image.new("RGB", (width * len(views), height + 90), "#f1eee7")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), title, fill="#202421", font=font(24))
    draw.text((12, 39), "Same perspective; resampled analysis views only. API originals remain unchanged.", fill="#505752", font=font(16))
    for i, (view, label) in enumerate(zip(views, labels)):
        draw.text((i * width + 12, 64), label, fill="#202421", font=font(18))
        canvas.paste(view, (i * width, 90))
    canvas.save(output)
    views[-1].save(output.with_name(output.stem + "-candidate.png"))


def seam_metric(image):
    pixels = image[192:-192].astype(np.float32)
    return float(np.abs(pixels[:, -1] - pixels[:, 0]).mean())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repair-dir", type=Path, default=DEFAULT)
    parser.add_argument("--output-dir", type=Path, help="Default: repair-dir; no public web export")
    parser.add_argument("--outer-fraction", type=float, default=.25,
                        help="Each cut's farthest distance from center / panorama width")
    parser.add_argument("--inner-fraction", type=float, default=.12,
                        help="Each cut's nearest distance from center / panorama width")
    parser.add_argument("--left-outer-fraction", type=float, help="Override left search corridor only")
    parser.add_argument("--left-inner-fraction", type=float, help="Override left search corridor only")
    parser.add_argument("--right-outer-fraction", type=float, help="Override right search corridor only")
    parser.add_argument("--right-inner-fraction", type=float, help="Override right search corridor only")
    parser.add_argument("--feather-pixels", type=int, default=3, choices=range(0, 5))
    parser.add_argument("--gradient-weight", type=float, default=.7)
    parser.add_argument("--edge-weight", type=float, default=.1)
    parser.add_argument("--step-penalty", type=float, default=.2)
    args = parser.parse_args()
    corridors = {}
    for side in ("left", "right"):
        outer = getattr(args, side + "_outer_fraction")
        inner = getattr(args, side + "_inner_fraction")
        outer = args.outer_fraction if outer is None else outer
        inner = args.inner_fraction if inner is None else inner
        if not 0 < inner < outer < .5:
            parser.error(f"Require 0 < {side} inner fraction < outer fraction < .5")
        corridors[side] = (outer, inner)
    if min(args.gradient_weight, args.edge_weight, args.step_penalty) < 0:
        parser.error("Cost weights must be nonnegative")
    directory = args.repair_dir.resolve()
    output = (args.output_dir or directory).resolve()
    output.mkdir(parents=True, exist_ok=True)
    a_path, b_path = directory / "rolled-input.png", directory / "repair-raw.png"
    original_hashes = {str(path): sha(path) for path in (a_path, b_path)}
    a, b = load(a_path), load(b_path)
    height, width = a.shape[:2]
    center = width // 2
    left_outer, left_inner = [round(width * value) for value in corridors["left"]]
    right_outer, right_inner = [round(width * value) for value in corridors["right"]]
    left, lm = find_cut(a, b, center - left_outer, center - left_inner,
                        args.gradient_weight, args.edge_weight, args.step_penalty)
    right, rm = find_cut(a, b, center + right_inner, center + right_outer,
                         args.gradient_weight, args.edge_weight, args.step_penalty)
    blend = weights(width, left, right, args.feather_pixels)
    combined = np.rint(a.astype(np.float32) * (1 - blend[..., None]) + b.astype(np.float32) * blend[..., None]).astype(np.uint8)
    assert np.array_equal(combined[:, :center - left_outer - 3], a[:, :center - left_outer - 3])
    assert np.array_equal(combined[:, center + right_outer + 3:], a[:, center + right_outer + 3:])
    assert np.array_equal(combined[:, center - 2:center + 2], b[:, center - 2:center + 2])
    native = np.roll(a, -center, axis=1)
    candidate = np.roll(combined, -center, axis=1)
    assert np.array_equal(candidate[:, 0], b[:, center])
    assert np.array_equal(candidate[:, -1], b[:, center - 1])
    candidate_path = output / "graphcut-composite.png"
    Image.fromarray(candidate).save(candidate_path, compress_level=3)
    Image.fromarray(combined).save(output / "graphcut-rolled-composite.png", compress_level=3)
    cut_review = Image.fromarray(b)
    draw = ImageDraw.Draw(cut_review)
    draw.line(list(zip(left.tolist(), range(height))), fill="#ff3151", width=5)
    draw.line(list(zip(right.tolist(), range(height))), fill="#13e78b", width=5)
    cut_review.resize((1920, 960), RESAMPLE).save(output / "graphcut-selected-paths.jpg", quality=94)
    fixed_path = directory / "finished-composite.png"
    arrays, labels = [native], ["Native before repair"]
    if fixed_path.is_file():
        arrays.append(load(fixed_path))
        labels.append("Previous fixed-feather composite")
    arrays.append(candidate)
    labels.append(f"Minimum-error cuts; {args.feather_pixels}px transition")
    review(arrays, labels, "Original longitude seam at center", math.pi, output / "graphcut-seam-review.png")
    review(arrays, labels, "Left dynamic cut region", 2 * math.pi * float(np.median(left)) / width,
           output / "graphcut-left-review.png", fov=70)
    review(arrays, labels, "Right dynamic cut region", 2 * math.pi * float(np.median(right)) / width,
           output / "graphcut-right-review.png", fov=70)
    review(arrays, labels, "Default TV view / original rolled boundary", -math.pi / 2,
           output / "graphcut-tv-review.png")
    yy = np.arange(height)
    report = {"algorithm": "Two independent minimum-error vertical dynamic-programming cuts (not general graph cut)",
              "inputs": [{"path": str(path), "sha256": original_hashes[str(path)]} for path in (a_path, b_path)],
              "candidate": {"path": str(candidate_path), "dimensions": list(Image.open(candidate_path).size), "sha256": sha(candidate_path)},
              "cost": {"color_mae": 1, "gradient_difference": args.gradient_weight,
                       "shared_edge_strength": args.edge_weight, "horizontal_step": args.step_penalty},
              "left": lm, "right": rm, "feather_total_width_pixels": args.feather_pixels,
              "left_mean_source_difference_at_path_255": float(np.abs(a[yy, left].astype(float) - b[yy, left]).mean()),
              "right_mean_source_difference_at_path_255": float(np.abs(a[yy, right].astype(float) - b[yy, right]).mean()),
              "native_wrap_rgb_mae_255": seam_metric(native), "candidate_wrap_rgb_mae_255": seam_metric(candidate),
              "raw_repair_center_adjacent_pixels_preserved_at_final_wrap": True,
              "rolled_outer_boundary_exactly_from_original": True,
              "mixed_pixel_fraction": float(((blend > 0) & (blend < 1)).mean()),
              "postprocessing": "Content-aware quilting of two already generated API images; no generation or native-resolution claim",
              "visual_acceptance": "pending: inspect cuts for object truncation, duplicates, color changes, and residual discontinuity",
              "metrics_are_descriptive_only": True, "web_assets_modified": False}
    for path in (a_path, b_path):
        assert sha(path) == original_hashes[str(path)], "Input unexpectedly changed"
    (output / "graphcut-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "graphcut-paths.json").write_text(json.dumps({"left_x_by_row": left.tolist(), "right_x_by_row": right.tolist()}) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
