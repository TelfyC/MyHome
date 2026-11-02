"""Validate real artifacts, dimensions and provenance; never infer success from a path."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from .assets import sha256_file
from .constraints import issue
from .models import QAReport, SceneSnapshot

PROFILES = {
    "preview_fast": (960, 540),
    "review": (1920, 1080),
    "final_still_4k": (3840, 2160),
    "panorama_8k_final": (8192, 4096),
    "panorama_preview": (2048, 1024),
    "draft_still_4k": (3840, 2160),
    "panorama_8k_preview": (8192, 4096),
}


def validate_build(scene: SceneSnapshot, directory: Path, *, source_path: Path | None = None, asset_manifest_path: Path | None = None) -> QAReport:
    issues, evidence = [], []
    try:
        manifest = json.loads((directory / "build_manifest.json").read_text())
        inspection = json.loads((directory / "inspection.json").read_text())
        blend = directory / "project.blend"
        if not blend.is_file() or blend.stat().st_size < 12:
            raise ValueError("project.blend does not exist or is empty")
        with blend.open("rb") as stream:
            if stream.read(7) not in (b"BLENDER", b"\x28\xb5\x2f\xfd\x00\x58\x44"):
                # Compressed Blender files use zstd or gzip, checked by reopen in worker.
                if not inspection.get("reopened", False) and not inspection.get("reopen_verified", False):
                    raise ValueError("Blender header not recognized and no reopen evidence")
        if manifest.get("project_id") != scene.project_id or manifest.get("scene_revision") != scene.revision:
            issues.append(issue("VERSION_001", "blocker", [], "Build is from a different project or Scene revision"))
        if not manifest.get("build_id") or manifest.get("project_blend_sha256") != sha256_file(blend):
            issues.append(issue("VERSION_001", "blocker", [], "Build ID missing or .blend hash differs from manifest"))
        if source_path and manifest.get("scene_hash") != sha256_file(source_path):
            issues.append(issue("VERSION_001", "blocker", [], "Source Scene hash differs from build manifest"))
        if asset_manifest_path and manifest.get("asset_manifest_hash") != sha256_file(asset_manifest_path):
            issues.append(issue("VERSION_001", "blocker", [], "Source asset manifest hash differs from build manifest"))
        for key in ("scene_revision", "scene_hash", "build_id"):
            if inspection.get(key) != manifest.get(key):
                issues.append(issue("VERSION_001", "blocker", [], f"Blender inspection {key} differs from build manifest"))
        mapping = inspection.get("object_mapping", {})
        expected = {item.id for item in [*scene.walls, *scene.openings, *scene.rooms, *scene.objects, *scene.cameras] if getattr(item, "demolition_status", None) != "remove"}
        missing = sorted(expected - set(mapping))
        if missing:
            issues.append(issue("SCENE_BLEND_MAPPING", "blocker", missing, "JSON entities missing from actual Blender inspection"))
        missing_textures = inspection.get("missing_textures", [])
        if missing_textures:
            issues.append(issue("ASSET_002", "error", [], "Blender inspection found missing textures", missing_textures))
        evidence.append({"path": str(blend), "sha256": sha256_file(blend), "build_id": manifest.get("build_id"), "inspection_path": str(directory / "inspection.json")})
    except (OSError, ValueError, TypeError) as exc:
        issues.append(issue("BUILD_ARTIFACT", "blocker", [], f"Build artifact validation failed: {exc}"))
    return QAReport.from_issues(scene, issues, evidence=evidence)


def validate_render(scene: SceneSnapshot, image_path: Path, manifest: dict, *, build_id: str, profile: str, camera_id: str | None = None, source_hash: str | None = None, blend_hash: str | None = None) -> QAReport:
    issues, evidence = [], []
    if profile not in PROFILES:
        return QAReport.from_issues(scene, [issue("RENDER_001", "blocker", [], "Unknown render profile")])
    expected = PROFILES[profile]
    if (manifest.get("project_id") != scene.project_id or manifest.get("scene_revision") != scene.revision or manifest.get("build_id") != build_id or manifest.get("render_profile_id") != profile):
        issues.append(issue("VERSION_001", "blocker", [], "Render project/revision/build/profile does not match requested provenance"))
    if camera_id is not None and manifest.get("camera_id") != camera_id:
        issues.append(issue("VERSION_001", "blocker", [], "Render camera differs from request"))
    if source_hash is not None and manifest.get("scene_hash") != source_hash:
        issues.append(issue("VERSION_001", "blocker", [], "Render source Scene hash differs from build source"))
    if blend_hash is not None and manifest.get("project_blend_sha256") != blend_hash:
        issues.append(issue("VERSION_001", "blocker", [], "Render .blend hash differs from the published build"))
    expected_projection = "equirectangular" if "panorama" in profile else "perspective"
    if manifest.get("projection") != expected_projection:
        issues.append(issue("RENDER_001", "blocker", [], "Render projection metadata differs from requested profile"))
    camera = next((c for c in scene.cameras if c.id == manifest.get("camera_id")), None)
    if camera is None:
        issues.append(issue("RENDER_001", "blocker", [], "Render references a camera absent from Scene"))
    elif (camera.type == "equirectangular") != ("panorama" in profile):
        issues.append(issue("RENDER_001", "blocker", [camera.id], "Render camera projection is incompatible with requested profile"))
    try:
        with Image.open(image_path) as image:
            size = image.size
            image.verify()
        if size != expected or list(size) != manifest.get("resolution_px"):
            issues.append(issue("RENDER_001", "blocker", [], "Image resolution differs from requested profile or manifest", list(size), str(expected)))
        if "panorama" in profile and (size[0] != 2 * size[1] or manifest.get("projection") != "equirectangular"):
            issues.append(issue("RENDER_001", "blocker", [], "Panorama must be 2:1 and marked equirectangular"))
        actual_hash = sha256_file(image_path)
        if manifest.get("file_sha256") != actual_hash:
            issues.append(issue("VERSION_001", "blocker", [], "Render file SHA256 differs from manifest"))
        evidence.append({"path": str(image_path), "sha256": actual_hash, "resolution_px": size, "build_id": build_id, "camera_id": manifest.get("camera_id")})
    except (OSError, ValueError, UnidentifiedImageError) as exc:
        issues.append(issue("RENDER_002", "blocker", [], f"Render file missing, corrupt or unreadable: {exc}"))
    return QAReport.from_issues(scene, issues, evidence=evidence)
