"""Registered asset gates. Development fixtures cannot pass final hero quality."""
from __future__ import annotations

import hashlib
from pathlib import Path

from .constraints import issue
from .models import AssetManifest, QAReport, SceneSnapshot

GENERATORS = frozenset({"sofa", "armchair", "coffee_table", "dining_table", "dining_chair", "chair", "bed", "bedside_table", "cabinet", "kitchen_run", "kitchen_cabinet", "fridge", "plant", "rug", "desk", "office_chair", "toilet", "shower", "vanity", "pendant", "bookcase", "tv"})


def sha256_file(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_local(uri: str, root: Path):
    if "://" in uri:
        if not uri.startswith("asset://"):
            raise ValueError("Only local registered assets are accepted")
        uri = uri[len("asset://"):]
    path = (root / uri).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Asset path leaves allowlisted asset root")
    return path


def validate_assets(scene: SceneSnapshot, manifest: AssetManifest, root: Path, *, final=False, commercial=True):
    catalog = {a.asset_id: a for a in manifest.assets}
    issues = []
    for obj in scene.objects:
        asset = catalog.get(obj.asset_id)
        if not asset:
            issues.append(issue("ASSET_001", "blocker", [obj.id], "asset_missing: object has no registered asset", obj.asset_id))
            continue
        if commercial and not asset.license.commercial_use_allowed:
            issues.append(issue("ASSET_LICENSE", "blocker", [obj.id], "Asset license disallows commercial use"))
        if asset.generator:
            if asset.generator not in GENERATORS:
                issues.append(issue("ASSET_001", "blocker", [obj.id], "Unknown deterministic generator", asset.generator))
            elif final:
                issues.append(issue("ASSET_001", "blocker", [obj.id], "Development generator has not been reviewed as a production asset"))
            else:
                issues.append(issue("ASSET_FIXTURE", "warning", [obj.id], "Project-authored development fixture; preview quality only"))
        elif not asset.file_uri or not asset.file_sha256:
            issues.append(issue("ASSET_001", "blocker", [obj.id], "Registered imported asset requires file path and SHA256"))
        else:
            try:
                path = resolve_local(asset.file_uri, root)
                if not path.is_file() or sha256_file(path) != asset.file_sha256:
                    raise ValueError("Asset file missing or hash mismatch")
                if path.suffix.lower() not in {".blend", ".glb", ".gltf", ".obj", ".fbx"}:
                    raise ValueError("Unsupported model format")
            except (ValueError, OSError) as exc:
                issues.append(issue("ASSET_001", "blocker", [obj.id], str(exc)))
        if final and obj.quality_tier == "hero":
            if asset.quality_tier != "hero" or not asset.approved or not asset.approval_evidence:
                issues.append(issue("ASSET_001", "blocker", [obj.id], "Hero asset requires approved audited production model"))
            if not all(asset.validation.get(key) is True for key in ("import_ok", "uv_ok", "materials_ok", "normals_ok")):
                issues.append(issue("ASSET_002", "error", [obj.id], "Hero asset import/UV/material/normal validation is incomplete"))
        for texture in getattr(asset, "textures", []):
            if not isinstance(texture, dict) or not texture.get("file_uri"):
                continue
            try:
                path = resolve_local(texture["file_uri"], root)
                if not path.is_file():
                    raise ValueError("Texture file missing")
                if texture.get("file_sha256") and sha256_file(path) != texture["file_sha256"]:
                    raise ValueError("Texture hash mismatch")
            except (ValueError, OSError) as exc:
                issues.append(issue("ASSET_002", "error", [obj.id], str(exc)))
    return QAReport.from_issues(scene, issues)
