"""Persisted finite jobs with frozen revisions and fixed Blender command templates."""
from __future__ import annotations

import json
import shutil
import sqlite3
import subprocess
import time
import uuid
from pathlib import Path

from .assets import validate_assets
from .constraints import validate_geometry
from .models import AssetManifest
from .qa import PROFILES, validate_build, validate_render
from .store import SceneError, SceneStore, canonical_json

STAGES = ("CREATED", "INPUT_VALIDATED", "BUILD_QUEUED", "BUILD_COMPLETED", "GEOMETRY_QA_PASSED", "LOOKDEV_PREVIEWED", "FINAL_RENDER_COMPLETED", "FINAL_QA_PASSED", "DELIVERED")


class JobService:
    def __init__(self, store: SceneStore, root: Path, *, blender: str = "blender", timeout_s: int = 1800):
        self.store, self.root = store, root.resolve()
        self.blender, self.timeout_s = blender, timeout_s
        with store.connection() as db:
            db.execute("CREATE TABLE IF NOT EXISTS jobs(job_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, revision INTEGER NOT NULL, json TEXT NOT NULL)")

    def _save(self, job):
        job["updated_at_unix"] = time.time()
        with self.store.connection() as db:
            db.execute("INSERT INTO jobs VALUES (?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET json=excluded.json", (job["job_id"], job["project_id"], job["scene_revision"], canonical_json(job)))
        return job

    def get(self, job_id):
        with self.store.connection() as db:
            row = db.execute("SELECT json FROM jobs WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            raise SceneError("Job not found", code="not_found")
        return json.loads(row[0])

    def list(self, project_id=None):
        with self.store.connection() as db:
            rows = db.execute("SELECT json FROM jobs" + (" WHERE project_id=?" if project_id else ""), (project_id,) if project_id else ())
            return [json.loads(row[0]) for row in rows]

    def create(self, project_id, revision, manifest: AssetManifest, *, final=False, camera_id=None, profile="preview_fast"):
        if profile not in PROFILES or (not final and profile in {"final_still_4k", "panorama_8k_final"}):
            raise SceneError("Invalid mode/profile combination")
        if final and profile not in {"final_still_4k", "panorama_8k_final"}:
            raise SceneError("Final jobs require a final render profile")
        scene = self.store.get(project_id, revision)
        if camera_id is not None and camera_id not in {c.id for c in scene.cameras}:
            raise SceneError("Camera not found", code="not_found")
        camera_id = camera_id or next((c.id for c in scene.cameras if (c.type == "equirectangular") == ("panorama" in profile)), None)
        if camera_id is None:
            raise SceneError("No compatible camera configured")
        camera = next(c for c in scene.cameras if c.id == camera_id)
        if (camera.type == "equirectangular") != ("panorama" in profile):
            raise SceneError("Camera projection is incompatible with profile")
        geometry = validate_geometry(scene, final=final)
        assets = validate_assets(scene, manifest, self.root / "assets", final=final)
        job = {
            "job_id": "job_" + uuid.uuid4().hex[:16], "project_id": project_id, "scene_revision": revision,
            "state": "CREATED", "mode": "final" if final else "preview", "profile": profile, "camera_id": camera_id,
            "attempts": 0, "max_attempts": 3, "events": [], "reports": {"geometry": geometry.model_dump(mode="json"), "assets": assets.model_dump(mode="json")},
            "asset_manifest": manifest.model_dump(mode="json"), "created_at_unix": time.time(),
        }
        if not geometry.passed or not assets.passed:
            job["state"], job["reason"] = "BLOCKED", "Input geometry, source, or asset gate failed"
        else:
            job["state"] = "INPUT_VALIDATED"
        return self._save(job)

    def _transition(self, job, state, **evidence):
        job["state"] = state
        job["events"].append({"state": state, "at_unix": time.time(), **evidence})
        return self._save(job)

    def _run_command(self, args, log):
        """No shell, arbitrary scripts, or caller supplied executable fragments."""
        with log.open("w") as output:
            result = subprocess.run(args, cwd=self.root, stdout=output, stderr=subprocess.STDOUT, timeout=self.timeout_s, check=False)
        if result.returncode:
            raise RuntimeError(f"Blender failed (exit {result.returncode}); log={log}")

    def run(self, job_id):
        # Claim under a database write lock, so two requests cannot run one job.
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT json FROM jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                raise SceneError("Job not found", code="not_found")
            job = json.loads(row[0])
            if job["state"] != "INPUT_VALIDATED":
                raise SceneError("Only validated new jobs may run", code="invalid_job_state")
            job["state"] = "BUILD_QUEUED"
            job["attempts"] += 1
            db.execute("UPDATE jobs SET json=? WHERE job_id=?", (canonical_json(job), job_id))
        scene = self.store.get(job["project_id"], job["scene_revision"])
        output = self.root / "outputs" / scene.project_id / f"r{scene.revision}" / job_id
        output.mkdir(parents=True, exist_ok=True)
        scene_path, assets_path = output / "scene_resolved.json", output / "asset_manifest.json"
        scene_path.write_text(scene.model_dump_json(indent=2))
        assets_path.write_text(json.dumps(job["asset_manifest"], indent=2))
        job["output_directory"] = str(output)
        try:
            binary = shutil.which(self.blender) or (self.blender if Path(self.blender).is_file() else None)
            if not binary:
                raise RuntimeError("Blender executable unavailable; set ARCHVIZ_BLENDER")
            common = [binary, "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1"]
            self._run_command([*common, "--python", str(self.root / "blender" / "build_scene.py"), "--", "--scene", str(scene_path), "--assets", str(assets_path), "--asset-root", str(self.root / "assets"), "--output", str(output)], output / "build.log")
            self._transition(job, "BUILD_COMPLETED")
            report = validate_build(scene, output, source_path=scene_path, asset_manifest_path=assets_path)
            job["reports"]["build"] = report.model_dump(mode="json")
            if not report.passed:
                raise RuntimeError("Build artifact QA failed")
            self._transition(job, "GEOMETRY_QA_PASSED")
            image_path = output / "renders" / f"{job['camera_id']}_{job['profile']}.png"
            image_path.parent.mkdir(exist_ok=True)
            self._run_command([*common, "--python", str(self.root / "blender" / "render_scene.py"), "--", "--blend", str(output / "project.blend"), "--camera", job["camera_id"], "--profile", job["profile"], "--output", str(image_path)], output / "render.log")
            render_manifest = json.loads(image_path.with_suffix(".manifest.json").read_text())
            build_manifest = json.loads((output / "build_manifest.json").read_text())
            report = validate_render(scene, image_path, render_manifest, build_id=build_manifest["build_id"], profile=job["profile"], camera_id=job["camera_id"], source_hash=build_manifest["scene_hash"], blend_hash=build_manifest["project_blend_sha256"])
            job["reports"]["render"] = report.model_dump(mode="json")
            if not report.passed:
                raise RuntimeError("Render artifact QA failed")
            job["image_path"] = str(image_path)
            if job["mode"] == "preview":
                self._transition(job, "LOOKDEV_PREVIEWED", note="Needs source confirmation and production asset review before final delivery")
            else:
                self._transition(job, "FINAL_RENDER_COMPLETED")
                # A human/visual review must still sign off; deterministic QA alone
                # does not justify DELIVERED or a fabricated visual score.
                self._transition(job, "WAITING_FOR_APPROVAL", reason="Visual QA review pending")
        except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired) as exc:
            job["reason"] = str(exc)
            self._transition(job, "FAILED")
        return self._save(job)

    def retry(self, job_id, remediation: str):
        job = self.get(job_id)
        if job["state"] != "FAILED":
            raise SceneError("Only failed jobs can be retried", code="invalid_job_state")
        prior = [event.get("remediation") for event in job["events"]]
        if job["attempts"] >= job["max_attempts"]:
            self._transition(job, "BLOCKED", reason="Three attempts exhausted; manual review required")
            raise SceneError("Retry limit reached", code="retry_limit")
        if not remediation.strip() or remediation in prior:
            raise SceneError("Retry requires a distinct recorded remediation")
        self._transition(job, "INPUT_VALIDATED", remediation=remediation)
        return job
