import json
from pathlib import Path

import pytest
from PIL import Image

from archviz.assets import sha256_file, validate_assets
from archviz.jobs import JobService
from archviz.models import AssetManifest, SceneSnapshot
from archviz.qa import validate_build, validate_render
from archviz.store import SceneError, SceneStore


def test_asset_missing(scene, tmp_path):
    report = validate_assets(scene, AssetManifest(assets=[]), tmp_path)
    assert not report.passed
    assert "asset_missing" in report.issues[0].description


def test_asset_license(scene, assets, tmp_path):
    assets.assets[0].license.commercial_use_allowed = False
    assert not validate_assets(scene, assets, tmp_path).passed


def test_fixtures_preview_only(scene, assets, tmp_path):
    assert validate_assets(scene, assets, tmp_path).passed
    assert not validate_assets(scene, assets, tmp_path, final=True).passed


def test_asset_hash_and_root_escape(scene, assets, tmp_path):
    asset = assets.assets[0]
    asset.generator = None
    asset.file_uri = "../../outside.glb"
    asset.file_sha256 = "a" * 64
    assert not validate_assets(scene, assets, tmp_path).passed
    asset.file_uri = "sofa.glb"
    (tmp_path / "sofa.glb").write_bytes(b"fixture-model")
    assert not validate_assets(scene, assets, tmp_path).passed
    asset.file_sha256 = sha256_file(tmp_path / "sofa.glb")
    assert validate_assets(scene, assets, tmp_path).passed


def render_metadata(scene, path, profile="panorama_preview"):
    return {"project_id": scene.project_id, "scene_revision": scene.revision, "build_id": "build_1", "camera_id": "camera_pano", "render_profile_id": profile, "file_sha256": sha256_file(path), "resolution_px": [2048, 1024], "projection": "equirectangular"}


def test_panorama_dimensions(scene, tmp_path):
    path = tmp_path / "pano.png"
    Image.new("RGB", (2048, 1024)).save(path)
    metadata = render_metadata(scene, path)
    assert validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").passed
    metadata["projection"] = "perspective"
    assert not validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").passed
    Image.new("RGB", (1920, 1080)).save(path)
    metadata = render_metadata(scene, path)
    assert not validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").passed


def test_render_version_and_camera(scene, tmp_path):
    path = tmp_path / "pano.png"
    Image.new("RGB", (2048, 1024)).save(path)
    metadata = render_metadata(scene, path)
    metadata["scene_revision"] = 0
    assert not validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").passed
    metadata["scene_revision"] = 1
    assert not validate_render(scene, path, metadata, build_id="wrong_build", profile="panorama_preview").passed
    assert not validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview", camera_id="wrong_camera").passed


def test_render_camera_and_source_hash(scene, tmp_path):
    path = tmp_path / "pano.png"
    Image.new("RGB", (2048, 1024)).save(path)
    metadata = render_metadata(scene, path)
    metadata["scene_hash"] = "a" * 64
    assert validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview", source_hash="a" * 64).passed
    assert not validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview", source_hash="b" * 64).passed
    metadata["camera_id"] = "camera_still"
    assert any("projection" in i.description for i in validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").issues)
    metadata["camera_id"] = "missing_camera"
    assert any("absent" in i.description for i in validate_render(scene, path, metadata, build_id="build_1", profile="panorama_preview").issues)


def test_render_artifact_exists(scene, tmp_path):
    path = tmp_path / "does_not_exist.png"
    report = validate_render(scene, path, {}, build_id="build_1", profile="preview_fast")
    assert not report.passed
    assert any(i.rule_id == "RENDER_002" for i in report.issues)
    assert not validate_build(scene, tmp_path).passed


def test_scene_blend_mapping(scene, tmp_path):
    blend = tmp_path / "project.blend"
    blend.write_bytes(b"BLENDER-fixture-for-contract-test-only")
    (tmp_path / "build_manifest.json").write_text(json.dumps({"project_id": scene.project_id, "scene_revision": 1, "build_id": "b1", "project_blend_sha256": sha256_file(blend)}))
    (tmp_path / "inspection.json").write_text(json.dumps({"object_mapping": {}}))
    report = validate_build(scene, tmp_path)
    assert any(i.rule_id == "SCENE_BLEND_MAPPING" for i in report.issues)


def test_build_source_and_asset_manifest_hashes(scene, tmp_path):
    blend = tmp_path / "project.blend"
    blend.write_bytes(b"BLENDER-contract-fixture")
    scene_path, assets_path = tmp_path / "scene.json", tmp_path / "assets.json"
    scene_path.write_text(scene.model_dump_json())
    assets_path.write_text('{"assets": []}')
    expected_ids = [x.id for x in [*scene.walls, *scene.openings, *scene.rooms, *scene.objects, *scene.cameras]]
    metadata = {"project_id": scene.project_id, "scene_revision": 1, "build_id": "b1", "scene_hash": sha256_file(scene_path), "asset_manifest_hash": sha256_file(assets_path), "project_blend_sha256": sha256_file(blend)}
    (tmp_path / "build_manifest.json").write_text(json.dumps(metadata))
    (tmp_path / "inspection.json").write_text(json.dumps({"scene_revision": 1, "build_id": "b1", "scene_hash": metadata["scene_hash"], "object_mapping": {key: [key] for key in expected_ids}}))
    assert validate_build(scene, tmp_path, source_path=scene_path, asset_manifest_path=assets_path).passed
    assets_path.write_text('{"assets": [], "tampered": true}')
    assert any("asset manifest hash" in i.description for i in validate_build(scene, tmp_path, source_path=scene_path, asset_manifest_path=assets_path).issues)


def test_job_pins_revision_and_final_blocks(scene, assets, tmp_path):
    store = SceneStore(tmp_path / "store.db")
    store.create(scene)
    jobs = JobService(store, tmp_path)
    job = jobs.create(scene.project_id, 1, assets)
    assert job["state"] == "INPUT_VALIDATED"
    assert jobs.get(job["job_id"])["scene_revision"] == 1
    final = jobs.create(scene.project_id, 1, assets, final=True, profile="final_still_4k")
    assert final["state"] == "BLOCKED"
    with pytest.raises(SceneError):
        jobs.run(final["job_id"])


def test_job_failed_command_never_claims_rendered(scene, assets, tmp_path):
    store = SceneStore(tmp_path / "store.db")
    store.create(scene)
    jobs = JobService(store, tmp_path, blender="nonexistent-plan-c-blender")
    job = jobs.create(scene.project_id, 1, assets)
    result = jobs.run(job["job_id"])
    assert result["state"] == "FAILED"
    assert "image_path" not in result


def test_qa_loop_limit(scene, assets, tmp_path):
    store = SceneStore(tmp_path / "store.db")
    store.create(scene)
    jobs = JobService(store, tmp_path, blender="nonexistent-plan-c-blender")
    job = jobs.create(scene.project_id, 1, assets)
    job_id = job["job_id"]
    for attempt in range(3):
        assert jobs.run(job_id)["state"] == "FAILED"
        if attempt < 2:
            jobs.retry(job_id, f"distinct remediation {attempt}")
    with pytest.raises(SceneError) as exc:
        jobs.retry(job_id, "fourth remediation")
    assert exc.value.code == "retry_limit"
    assert jobs.get(job_id)["state"] == "BLOCKED"


def test_retry_requires_distinct_remediation(scene, assets, tmp_path):
    store = SceneStore(tmp_path / "store.db")
    store.create(scene)
    jobs = JobService(store, tmp_path, blender="nonexistent-plan-c-blender")
    job_id = jobs.create(scene.project_id, 1, assets)["job_id"]
    jobs.run(job_id)
    jobs.retry(job_id, "install blender")
    jobs.run(job_id)
    with pytest.raises(SceneError):
        jobs.retry(job_id, "install blender")


def test_real_fixture_asset_preview_final_gate(tmp_path):
    root = Path(__file__).resolve().parents[1]
    scene = SceneSnapshot.model_validate_json((root / "data/sunlit/scene.json").read_text())
    assets = AssetManifest.model_validate_json((root / "data/sunlit/asset_manifest.json").read_text())
    assert validate_assets(scene, assets, root / "assets").passed
    assert not validate_assets(scene, assets, root / "assets", final=True).passed


def test_worker_serialization_fills_material_defaults_preserves_unknown_site(tmp_path):
    root = Path(__file__).resolve().parents[1]
    scene = SceneSnapshot.model_validate_json((root / "data/sunlit/scene.json").read_text())
    store = SceneStore(tmp_path / "store.db")
    store.create(scene)
    # This is the exact serializer used to hand the pinned Scene to Blender.
    snapshot = json.loads(store.get(scene.project_id, scene.revision).model_dump_json(indent=2))
    for material in snapshot["materials"]:
        assert isinstance(material["base_color"], (str, list))
        assert isinstance(material["roughness"], (int, float))
        assert isinstance(material["metallic"], (int, float))
        assert len(material["texture_repeat_m"]) == 2
        assert all(value > 0 for value in material["texture_repeat_m"])
    assert snapshot["site"]["true_north_offset_rad"] is None
    assert snapshot["site"]["latitude"] is None
    assert snapshot["site"]["longitude"] is None
