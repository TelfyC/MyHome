from fastapi.testclient import TestClient

from archviz.api import create_app


def test_api_scene_and_patch(scene, tmp_path):
    app = create_app(state_dir=tmp_path / "state", project_root=tmp_path, bootstrap=False)
    with TestClient(app) as client:
        assert client.get("/api/health").json()["llm_agents"] == "not_connected"
        assert client.post("/api/projects", json=scene.model_dump(mode="json")).status_code == 201
        assert client.get("/api/projects/test_home/scene").json()["revision"] == 1
        assert client.get("/api/projects/missing/scene").status_code == 404
        payload = {"project_id": "test_home", "expected_revision": 1, "patch_id": "move_sofa", "operations": [{"op": "translate", "object_id": "sofa", "delta_m": [0.2, 0, 0]}]}
        response = client.post("/api/projects/test_home/patches", json=payload)
        assert response.status_code == 200
        assert response.json()["scene_revision"] == 2
        assert client.post("/api/projects/test_home/patches", json=payload).status_code == 409
        assert client.get("/api/contracts/scene").status_code == 200
        assert client.get("/api/contracts/unknown").status_code == 404


def test_api_unknown_structure_cannot_demolish(scene, tmp_path):
    app = create_app(state_dir=tmp_path / "state", project_root=tmp_path, bootstrap=False)
    with TestClient(app) as client:
        client.post("/api/projects", json=scene.model_dump(mode="json"))
        payload = {"project_id": "test_home", "expected_revision": 1, "patch_id": "remove_wall", "requested_by": "user", "operations": [{"op": "remove_wall", "object_id": "wall_s"}]}
        response = client.post("/api/projects/test_home/patches", json=payload)
        assert response.status_code == 409
        assert response.json()["error"] == "STRUCT_002"
        assert client.get("/api/projects/test_home/scene").json()["revision"] == 1


def test_api_job_missing_assets_blocked(scene, tmp_path):
    app = create_app(state_dir=tmp_path / "state", project_root=tmp_path, bootstrap=False)
    with TestClient(app) as client:
        client.post("/api/projects", json=scene.model_dump(mode="json"))
        response = client.post("/api/projects/test_home/jobs", json={"scene_revision": 1})
        assert response.status_code == 202
        assert response.json()["state"] == "BLOCKED"
        job_id = response.json()["job_id"]
        assert client.get(f"/api/jobs/{job_id}").json()["state"] == "BLOCKED"
        assert client.get(f"/api/jobs/{job_id}/artifacts/scene.sqlite").status_code == 404
