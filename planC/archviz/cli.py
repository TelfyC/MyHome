"""Command line entry points; explicit validation and local workers only."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .assets import validate_assets
from .constraints import validate_geometry
from .models import AssetManifest, ScenePatch, SceneSnapshot
from .store import SceneStore


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(prog="archviz")
    parser.add_argument("command", choices=["validate", "serve", "schemas", "import", "patch", "build"])
    parser.add_argument("--scene", type=Path, default=root / "data/sunlit/scene.json")
    parser.add_argument("--assets", type=Path, default=root / "data/sunlit/asset_manifest.json")
    parser.add_argument("--state-dir", type=Path, default=root / ".state")
    parser.add_argument("--final", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--patch", type=Path)
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--camera")
    parser.add_argument("--profile", default="preview_fast")
    parser.add_argument("--port", type=int, default=8011)
    args = parser.parse_args()
    if args.command == "serve":
        import uvicorn
        from .api import create_app
        uvicorn.run(create_app(state_dir=args.state_dir), host="127.0.0.1", port=args.port)
        return
    if args.command == "schemas":
        target = args.output or root / "schemas"
        target.mkdir(parents=True, exist_ok=True)
        for name, model in [("scene", SceneSnapshot), ("patch", ScenePatch), ("assets", AssetManifest)]:
            (target / f"{name}.schema.json").write_text(json.dumps(model.model_json_schema(), ensure_ascii=False, indent=2))
        return
    scene = SceneSnapshot.model_validate_json(args.scene.read_text())
    manifest = AssetManifest.model_validate_json(args.assets.read_text())
    if args.command == "validate":
        geometry = validate_geometry(scene, final=args.final)
        assets = validate_assets(scene, manifest, root / "assets", final=args.final)
        report = {"geometry": geometry.model_dump(mode="json"), "assets": assets.model_dump(mode="json")}
        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered)
        else:
            print(rendered)
        raise SystemExit(0 if geometry.passed and assets.passed else 1)
    store = SceneStore(args.state_dir / "scene.sqlite")
    if args.command == "import":
        store.create(scene)
        print(json.dumps({"project_id": scene.project_id, "scene_revision": scene.revision}))
    elif args.command == "patch":
        if not args.patch:
            parser.error("patch command requires --patch JSON")
        result = store.patch(ScenePatch.model_validate_json(args.patch.read_text()))
        print(result["scene"].model_dump_json(indent=2))
    elif args.command == "build":
        from .jobs import JobService
        if not any(p["project_id"] == scene.project_id for p in store.list_projects()):
            store.create(scene)
        service = JobService(store, root, blender=args.blender)
        job = service.create(scene.project_id, scene.revision, manifest, final=args.final, camera_id=args.camera, profile=args.profile)
        if job["state"] == "INPUT_VALIDATED":
            job = service.run(job["job_id"])
        print(json.dumps(job, ensure_ascii=False, indent=2))
        raise SystemExit(0 if job["state"] in {"LOOKDEV_PREVIEWED", "WAITING_FOR_APPROVAL"} else 1)


if __name__ == "__main__":
    main()
