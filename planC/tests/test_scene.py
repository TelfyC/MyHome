import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import ValidationError

from archviz.constraints import validate_geometry
from archviz.models import Material, ScenePatch, SceneSnapshot
from archviz.store import SceneError, SceneStore, digest


def patch(scene, **op):
    return ScenePatch(project_id=scene.project_id, expected_revision=scene.revision, patch_id="patch_test", requested_by="user", operations=[op])


def test_valid_closed_scene(scene):
    assert validate_geometry(scene).status == "pass"


@pytest.mark.parametrize("state", ["load_bearing", "unknown"])
def test_wall_protected(scene, tmp_path, state):
    scene.walls[0].structural_state = state
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    with pytest.raises(SceneError, match="Protected"):
        store.patch(patch(scene, op="remove_wall", object_id="wall_s"))
    assert store.get(scene.project_id).revision == 1


def test_opening_host_wall(scene):
    scene.openings[0].width_m = 8
    assert any(i.rule_id == "GEO_002" and i.severity == "blocker" for i in validate_geometry(scene).issues)


def test_opening_vertical_bounds(scene):
    scene.openings[0].sill_height_m = 2
    assert not validate_geometry(scene).passed


def test_room_polygon_self_intersection(scene):
    scene.rooms[0].boundary_xy_m = [(0, 0), (5, 5), (5, 0), (0, 5)]
    assert any(i.rule_id == "GEO_001" for i in validate_geometry(scene).issues)


def test_room_degenerate_polygon(scene):
    scene.rooms[0].boundary_xy_m = [(0, 0), (1, 0), (2, 0)]
    assert not validate_geometry(scene).passed


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_finite_coordinates(scene, value):
    data = scene.model_dump(mode="json")
    data["objects"][0]["transform"]["position_m"][0] = value
    with pytest.raises(ValidationError):
        SceneSnapshot.model_validate(data)


def test_unique_ids_and_host_references(scene):
    data = scene.model_dump(mode="json")
    data["openings"][0]["host_wall_id"] = "missing_wall"
    with pytest.raises(ValidationError):
        SceneSnapshot.model_validate(data)
    data["openings"][0]["host_wall_id"] = "wall_s"
    data["objects"][0]["id"] = "wall_s"
    with pytest.raises(ValidationError):
        SceneSnapshot.model_validate(data)


def test_scene_incremental_and_optimistic_lock(scene, tmp_path):
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    original = digest([w.model_dump(mode="json") for w in scene.walls])
    p = patch(scene, op="translate", object_id="sofa", delta_m=[0.2, 0, 0])
    result = store.patch(p)
    assert result["scene"].objects[0].transform.position_m == (2.2, 2, 0)
    assert digest([w.model_dump(mode="json") for w in result["scene"].walls]) == original
    with pytest.raises(SceneError) as exc:
        store.patch(p)
    assert exc.value.code == "revision_conflict"
    assert len(store.history(scene.project_id)) == 2


def test_patch_transaction_rollback(scene, tmp_path):
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    with pytest.raises(SceneError):
        store.patch(patch(scene, op="translate", object_id="sofa", delta_m=[-5, 0, 0]))
    assert store.get(scene.project_id).model_dump() == scene.model_dump()
    assert len(store.history(scene.project_id)) == 1


def test_concurrent_patches_only_one_commits(scene, tmp_path):
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    p = patch(scene, op="translate", object_id="sofa", delta_m=[0.1, 0, 0])
    def attempt(_):
        try:
            store.patch(p)
            return "success"
        except SceneError as exc:
            return exc.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, range(2))) == ["revision_conflict", "success"]
    assert store.get(scene.project_id).revision == 2


def test_rotated_footprint_catches_wall(scene):
    scene.objects[0].transform.position_m = (0.4, 2, 0)
    scene.objects[0].transform.rotation_euler_rad = (0, 0, 0.785)
    assert any(i.rule_id == "FURN_001" for i in validate_geometry(scene).issues)


def test_floating_object_requires_support(scene):
    scene.objects[0].transform.position_m = (2, 2, 0.5)
    assert any(i.rule_id == "FURN_002" for i in validate_geometry(scene).issues)


def test_real_home1_preview_valid_final_blocked():
    path = Path(__file__).resolve().parents[1] / "data/sunlit/scene.json"
    data = SceneSnapshot.model_validate_json(path.read_text())
    assert validate_geometry(data).passed
    assert not validate_geometry(data, final=True).passed
    assert data.site.true_north_offset_rad is None


def test_scene_patch_preserves_custom_metadata(scene, tmp_path):
    scene.metadata["source_note"] = "A drawing estimate, not measured"
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    result = store.patch(patch(scene, op="translate", object_id="sofa", delta_m=[0.1, 0, 0]))
    assert result["scene"].metadata == scene.metadata


def test_material_reference_must_exist(scene):
    data = scene.model_dump(mode="json")
    data["objects"][0]["material_id"] = "missing_material"
    with pytest.raises(ValidationError, match="Unknown material"):
        SceneSnapshot.model_validate(data)


@pytest.mark.parametrize("values", [
    {"base_color": "olive"}, {"base_color": [1, 0.2, float("nan")]},
    {"base_color": [1.1, 0.2, 0.1]}, {"roughness": -0.1}, {"metallic": 1.1},
    {"texture_repeat_m": [0, 1]}, {"texture_repeat_m": [1, float("inf")]},
])
def test_material_pbr_values_are_bounded(values):
    with pytest.raises(ValidationError):
        Material(id="mat_test", **values)


def test_material_hex_and_rgb_contracts():
    assert Material(id="mat_hex", base_color="#aB30fF").base_color == "#aB30fF"
    assert Material(id="mat_rgb", base_color=[0.1, 0.2, 0.3]).base_color == (0.1, 0.2, 0.3)


def test_set_material_commits_canonical_source(scene, tmp_path):
    scene.materials.append(Material(id="mat_green", base_color="#76956b", roughness=0.7))
    store = SceneStore(tmp_path / "scene.db")
    store.create(scene)
    result = store.patch(patch(scene, op="set_material", object_id="sofa", material_id="mat_green"))
    assert result["scene"].revision == 2
    assert result["scene"].objects[0].material_id == "mat_green"
    assert store.get(scene.project_id).objects[0].material_id == "mat_green"
    assert store.get(scene.project_id, 1).objects[0].material_id is None
    assert digest([w.model_dump(mode="json") for w in result["scene"].walls]) == digest([w.model_dump(mode="json") for w in scene.walls])
    missing_material_patch = patch(result["scene"], op="set_material", object_id="sofa", material_id="missing_material")
    missing_material_patch.patch_id = "missing_material_patch"
    with pytest.raises(SceneError, match="Material not found"):
        store.patch(missing_material_patch)
    assert store.get(scene.project_id).revision == 2
