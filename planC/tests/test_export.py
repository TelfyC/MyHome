"""Exporter tests use clearly labelled fake .blend bytes, never real delivery files."""
import importlib.util
import json
from pathlib import Path

import pytest
from PIL import Image

from archviz.assets import sha256_file

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/export_site.py"
spec = importlib.util.spec_from_file_location("planc_export_site_test", SCRIPT)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


@pytest.fixture
def export_fixture(scene, assets, tmp_path):
    scene.cameras[0].id = "camera_living_still"
    scene.cameras[1].id = "camera_living_360"
    source = tmp_path / "source/scene.json"
    manifest_path = tmp_path / "source/asset_manifest.json"
    write_json(source, scene.model_dump(mode="json"))
    write_json(manifest_path, assets.model_dump(mode="json"))
    build = tmp_path / "build"
    build.mkdir()
    # Deliberately synthetic contract fixture; an actual Blender reopen is tested
    # separately by the recorded Blender worker smoke, never claimed here.
    blend = build / "project.blend"
    blend.write_bytes(b"BLENDER-explicit-test-fixture-not-a-real-model")
    source_hash, assets_hash = sha256_file(source), sha256_file(manifest_path)
    metadata = {"project_id": scene.project_id, "scene_revision": 1, "build_id": "build_export_fixture", "scene_hash": source_hash, "asset_manifest_hash": assets_hash, "project_blend_sha256": sha256_file(blend)}
    write_json(build / "build_manifest.json", metadata)
    mapping_ids = [item.id for item in [*scene.walls, *scene.openings, *scene.rooms, *scene.objects, *scene.cameras]]
    write_json(build / "inspection.json", {"scene_revision": 1, "scene_hash": source_hash, "build_id": metadata["build_id"], "object_mapping": {key: [key] for key in mapping_ids}})
    render_dir = build / "renders"
    render_dir.mkdir()
    image = render_dir / "living.png"
    Image.new("RGB", (960, 540), (180, 190, 170)).save(image)
    render = {"project_id": scene.project_id, "scene_revision": 1, "scene_hash": source_hash, "build_id": metadata["build_id"], "camera_id": "camera_living_still", "render_profile_id": "preview_fast", "projection": "perspective", "image_uri": image.name, "file_sha256": sha256_file(image), "resolution_px": [960, 540], "project_blend_sha256": metadata["project_blend_sha256"]}
    render_manifest = image.with_suffix(".manifest.json")
    write_json(render_manifest, render)
    dest = tmp_path / "public"
    dest.mkdir()
    (dest / "project.json").write_text('{"existing_published_version":true}')
    (dest / "scene.json").write_text('existing scene sentinel')
    return {"scene": source, "assets": manifest_path, "build": build, "dest": dest, "render": render, "render_manifest": render_manifest}


def run_export(fixture, monkeypatch):
    monkeypatch.setattr("sys.argv", [str(SCRIPT), "--scene", str(fixture["scene"]), "--assets", str(fixture["assets"]), "--build", str(fixture["build"]), "--destination", str(fixture["dest"]), "--asset-root", str(fixture["scene"].parent)])
    exporter.main()


def test_export_preserves_scene_snapshots_and_matching_render(export_fixture, monkeypatch):
    run_export(export_fixture, monkeypatch)
    dest = export_fixture["dest"]
    project = json.loads((dest / "project.json").read_text())
    assert project["build_id"] == "build_export_fixture"
    assert project["rooms"][0]["still"] == "renders/living.png"
    assert (dest / "scene_structure.json").is_file()
    assert (dest / "scene_design.json").is_file()
    assert json.loads((dest / "reports/production_gate.json").read_text())["status"] == "fail"


@pytest.mark.parametrize("change", [
    {"build_id": "old_build"},
    {"camera_id": "absent_camera"},
    {"project_id": "different_project"},
    {"render_profile_id": "review"},
    {"project_blend_sha256": "wrong_blend_hash"},
])
def test_invalid_or_stale_render_keeps_published_version(export_fixture, monkeypatch, change):
    data = {**export_fixture["render"], **change}
    write_json(export_fixture["render_manifest"], data)
    with pytest.raises(ValueError):
        run_export(export_fixture, monkeypatch)
    dest = export_fixture["dest"]
    assert json.loads((dest / "project.json").read_text()) == {"existing_published_version": True}
    assert (dest / "scene.json").read_text() == "existing scene sentinel"
    assert not (dest / "project.blend").exists()


def test_invalid_build_mapping_keeps_published_version(export_fixture, monkeypatch):
    inspection = export_fixture["build"] / "inspection.json"
    data = json.loads(inspection.read_text())
    data["object_mapping"] = {}
    write_json(inspection, data)
    with pytest.raises(ValueError, match="Build QA"):
        run_export(export_fixture, monkeypatch)
    assert (export_fixture["dest"] / "scene.json").read_text() == "existing scene sentinel"
