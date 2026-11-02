"""Local API for explicit scene patches, QA and controlled Blender jobs."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .assets import validate_assets
from .constraints import validate_geometry
from .jobs import JobService
from .models import AssetManifest, ScenePatch, SceneSnapshot
from .store import SceneError, SceneStore

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class CreateJob(BaseModel):
    scene_revision: int = Field(ge=1)
    mode: Literal["preview", "final"] = "preview"
    camera_id: str | None = None
    render_profile_id: Literal["preview_fast", "review", "panorama_preview", "draft_still_4k", "panorama_8k_preview", "final_still_4k", "panorama_8k_final"] = "preview_fast"


class RetryJob(BaseModel):
    remediation: str = Field(min_length=3, max_length=1000)


def create_app(*, state_dir: Path | None = None, project_root: Path | None = None, bootstrap=True):
    root = (project_root or PROJECT_ROOT).resolve()
    state = state_dir or Path(os.environ.get("ARCHVIZ_STATE_DIR", str(root / ".state")))
    store = SceneStore(state / "scene.sqlite")
    jobs = JobService(store, root, blender=os.environ.get("ARCHVIZ_BLENDER", "blender"))
    app = FastAPI(title="Home Plan C · Scene & Blender", version="0.1.0", description="Deterministic Phase 0/1 core. Fixture preview is not final calibrated or production quality delivery.")
    app.state.store, app.state.jobs = store, jobs
    default_catalog = root / "data" / "sunlit" / "asset_manifest.json"

    def catalog():
        if not default_catalog.is_file():
            return AssetManifest(assets=[])
        return AssetManifest.model_validate_json(default_catalog.read_text())

    if bootstrap:
        demo = root / "data" / "sunlit" / "scene.json"
        if demo.is_file():
            scene = SceneSnapshot.model_validate_json(demo.read_text())
            if not any(p["project_id"] == scene.project_id for p in store.list_projects()):
                store.create(scene)

    @app.exception_handler(SceneError)
    async def scene_error(_request, exc: SceneError):
        from fastapi.responses import JSONResponse
        status = {"not_found": 404, "revision_conflict": 409, "project_exists": 409, "forbidden": 403, "STRUCT_001": 409, "STRUCT_002": 409}.get(exc.code, 422)
        return JSONResponse(status_code=status, content={"status": "failed", "error": exc.code, "message": str(exc), "details": exc.details})

    @app.get("/api/health")
    def health():
        return {"status": "success", "version": "0.1.0", "capabilities": ["scene_store", "transactional_patch", "geometry_qa", "asset_gate", "blender_build", "cycles_render"], "llm_agents": "not_connected"}

    @app.get("/api/projects")
    def projects():
        return {"projects": store.list_projects()}

    @app.post("/api/projects", status_code=201)
    def create_project(scene: SceneSnapshot):
        return store.create(scene)

    @app.get("/api/projects/{project_id}")
    def project(project_id: str):
        scene = store.get(project_id)
        return {"project_id": scene.project_id, "scene_revision": scene.revision, "history": store.history(project_id), "jobs": jobs.list(project_id)}

    @app.get("/api/projects/{project_id}/scene")
    def scene_get(project_id: str, revision: int | None = None):
        return store.get(project_id, revision)

    @app.post("/api/projects/{project_id}/patches")
    def scene_patch(project_id: str, patch: ScenePatch):
        if project_id != patch.project_id:
            raise SceneError("URL project and patch project must match")
        result = store.patch(patch)
        return {"status": "success", "scene_revision": result["scene"].revision, "changed_object_ids": result["changed_object_ids"], "requires_rebuild": True, "report": result["report"]}

    @app.get("/api/projects/{project_id}/reports")
    def reports(project_id: str, revision: int | None = None, final: bool = False):
        scene = store.get(project_id, revision)
        return {"geometry": validate_geometry(scene, final=final), "assets": validate_assets(scene, catalog(), root / "assets", final=final)}

    @app.get("/api/assets")
    def assets(category: str | None = None):
        return {"assets": [a for a in catalog().assets if category is None or a.category == category]}

    @app.get("/api/assets/{asset_id}")
    def asset(asset_id: str):
        entry = next((a for a in catalog().assets if a.asset_id == asset_id), None)
        if entry is None:
            raise SceneError("Asset not found", code="not_found")
        return entry

    @app.post("/api/projects/{project_id}/jobs", status_code=202)
    def create_job(project_id: str, request: CreateJob, background: BackgroundTasks):
        job = jobs.create(project_id, request.scene_revision, catalog(), final=request.mode == "final", camera_id=request.camera_id, profile=request.render_profile_id)
        if job["state"] == "INPUT_VALIDATED":
            background.add_task(jobs.run, job["job_id"])
        return job

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str):
        return jobs.get(job_id)

    @app.post("/api/jobs/{job_id}/retry", status_code=202)
    def retry_job(job_id: str, request: RetryJob, background: BackgroundTasks):
        job = jobs.retry(job_id, request.remediation)
        background.add_task(jobs.run, job_id)
        return job

    @app.get("/api/jobs/{job_id}/artifacts/{name}")
    def artifact(job_id: str, name: str):
        job = jobs.get(job_id)
        directory = Path(job.get("output_directory", ""))
        if name not in {"project.blend", "scene_resolved.json", "asset_manifest.json", "build_manifest.json", "inspection.json", "build.log", "render.log", "render.png"}:
            raise HTTPException(404, "Artifact is not in the published allowlist")
        path = Path(job.get("image_path", "")) if name == "render.png" else directory / name
        if not path.is_file() or not path.resolve().is_relative_to((root / "outputs").resolve()):
            raise HTTPException(404, "Artifact unavailable")
        return FileResponse(path)

    @app.get("/api/contracts/{name}")
    def contracts(name: str):
        schemas = {"scene": SceneSnapshot, "patch": ScenePatch, "assets": AssetManifest}
        if name not in schemas:
            raise HTTPException(404, "Unknown contract")
        return schemas[name].model_json_schema()

    return app


app = create_app()
