"""SQLite revision store: optimistic locks and audit history commit atomically."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .constraints import validate_geometry
from .models import ScenePatch, SceneSnapshot


def canonical_json(value):
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


class SceneError(ValueError):
    def __init__(self, message, *, code="invalid_scene", details=None):
        super().__init__(message)
        self.code, self.details = code, details


class SceneStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS projects(project_id TEXT PRIMARY KEY, head INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS scenes(project_id TEXT NOT NULL, revision INTEGER NOT NULL, json TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id, revision));
                CREATE TABLE IF NOT EXISTS patches(project_id TEXT NOT NULL, patch_id TEXT NOT NULL, input_revision INTEGER NOT NULL, output_revision INTEGER NOT NULL, json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id, patch_id));
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def create(self, scene: SceneSnapshot) -> SceneSnapshot:
        report = validate_geometry(scene)
        if not report.passed:
            raise SceneError("Initial scene failed geometry constraints", details=report.model_dump(mode="json"))
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT 1 FROM projects WHERE project_id=?", (scene.project_id,)).fetchone():
                raise SceneError("Project already exists", code="project_exists")
            db.execute("INSERT INTO projects VALUES (?,?)", (scene.project_id, scene.revision))
            self._insert(db, scene)
        return scene

    @staticmethod
    def _insert(db, scene):
        db.execute("INSERT INTO scenes VALUES (?,?,?,?,?)", (scene.project_id, scene.revision, canonical_json(scene), digest(scene), datetime.now(timezone.utc).isoformat()))

    def list_projects(self):
        with self.connection() as db:
            return [dict(row) for row in db.execute("SELECT project_id,head AS revision FROM projects ORDER BY project_id")]

    def get(self, project_id: str, revision: int | None = None):
        with self.connection() as db:
            return self._get(db, project_id, revision)

    @staticmethod
    def _get(db, project_id, revision=None):
        if revision is None:
            row = db.execute("SELECT head FROM projects WHERE project_id=?", (project_id,)).fetchone()
            if not row:
                raise SceneError("Project not found", code="not_found")
            revision = row[0]
        row = db.execute("SELECT json FROM scenes WHERE project_id=? AND revision=?", (project_id, revision)).fetchone()
        if not row:
            raise SceneError("Scene revision not found", code="not_found")
        return SceneSnapshot.model_validate_json(row[0])

    def patch(self, patch: ScenePatch):
        if patch.requested_by not in {"design_agent", "asset_agent", "lighting_agent", "user", "design", "asset", "lighting"}:
            raise SceneError("Agent is not allowed to commit Scene patches", code="forbidden")
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            current = self._get(db, patch.project_id)
            if current.revision != patch.expected_revision:
                raise SceneError("Revision conflict; reread before retry", code="revision_conflict", details={"expected": patch.expected_revision, "actual": current.revision})
            if db.execute("SELECT 1 FROM patches WHERE project_id=? AND patch_id=?", (patch.project_id, patch.patch_id)).fetchone():
                raise SceneError("Patch ID already committed", code="duplicate_patch")
            data = current.model_dump(mode="json")
            object_map = {obj["id"]: obj for obj in data["objects"]}
            wall_map = {wall["id"]: wall for wall in data["walls"]}
            for op in patch.operations:
                if op.op in {"update_wall", "remove_wall"}:
                    wall = wall_map.get(op.object_id)
                    if not wall:
                        raise SceneError("Wall not found", code="not_found")
                    if wall["structural_state"] in {"load_bearing", "unknown"}:
                        raise SceneError("Protected/unknown structure cannot be changed", code="STRUCT_001" if wall["structural_state"] == "load_bearing" else "STRUCT_002", details={"object_id": op.object_id, "severity": "blocker"})
                    if patch.requested_by != "user":
                        raise SceneError("Structure proposals require explicit user commit", code="forbidden")
                    if op.op == "remove_wall":
                        wall["demolition_status"] = "remove"
                    else:
                        allowed = {"path_xy_m", "thickness_m", "height_m", "demolition_status"}
                        if not set(op.values or {}) <= allowed:
                            raise SceneError("Wall patch attempts to change protected metadata", code="forbidden")
                        wall.update(op.values or {})
                    continue
                obj = object_map.get(op.object_id)
                if not obj:
                    raise SceneError("Object not found", code="not_found")
                if op.op == "translate":
                    obj["transform"]["position_m"] = [a + b for a, b in zip(obj["transform"]["position_m"], op.delta_m)]
                elif op.op == "rotate":
                    obj["transform"]["rotation_euler_rad"] = list(op.rotation_euler_rad)
                elif op.op == "set_material":
                    if op.material_id not in {m["id"] for m in data["materials"]}:
                        raise SceneError("Material not found", code="not_found")
                    obj["material_id"] = op.material_id
            data["revision"] = current.revision + 1
            updated = SceneSnapshot.model_validate(data)
            report = validate_geometry(updated)
            if not report.passed:
                raise SceneError("Patch failed geometry constraints", details=report.model_dump(mode="json"))
            self._insert(db, updated)
            db.execute("UPDATE projects SET head=? WHERE project_id=?", (updated.revision, updated.project_id))
            db.execute("INSERT INTO patches VALUES (?,?,?,?,?,?)", (patch.project_id, patch.patch_id, current.revision, updated.revision, canonical_json(patch), datetime.now(timezone.utc).isoformat()))
        return {"scene": updated, "report": report, "changed_object_ids": list(dict.fromkeys(op.object_id for op in patch.operations)), "requires_rebuild": True}

    def history(self, project_id):
        with self.connection() as db:
            return [dict(row) for row in db.execute("SELECT revision,hash,created_at FROM scenes WHERE project_id=? ORDER BY revision", (project_id,))]
