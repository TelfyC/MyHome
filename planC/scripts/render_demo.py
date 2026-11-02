"""Rebuild/reuse a validated demo, render requested views, then export the site.

This wrapper executes only the two checked-in Blender scripts and fixed
profiles. Previews never bypass the independent production delivery gate.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'planC'))
from archviz.models import SceneSnapshot, AssetManifest
from archviz.constraints import validate_geometry
from archviz.assets import validate_assets, sha256_file
from archviz.qa import validate_build, validate_render

ROOMS = ['living', 'dining', 'master', 'guest', 'study', 'kitchen', 'bathroom']


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rooms', nargs='+', choices=ROOMS, default=['living'])
    p.add_argument('--panorama', action='store_true')
    p.add_argument('--high-resolution', action='store_true', help='4K/8K native previews, still not approved final delivery')
    p.add_argument('--still-profile', choices=['preview_fast', 'review'], default='review')
    p.add_argument('--blender', default=os.environ.get('ARCHVIZ_BLENDER', str(ROOT / 'planC/.tools/blender-4.5.3-linux-x64/blender')))
    p.add_argument('--output', type=Path, default=ROOT / 'planC/outputs/home1_sunlit/r1')
    p.add_argument('--rebuild', action='store_true')
    args = p.parse_args()
    source = ROOT / 'planC/data/sunlit/scene.json'
    assets_path = source.parent / 'asset_manifest.json'
    scene = SceneSnapshot.model_validate_json(source.read_text())
    assets = AssetManifest.model_validate_json(assets_path.read_text())
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    reports = out / 'reports'
    reports.mkdir(exist_ok=True)
    for name, report in [('geometry_qa', validate_geometry(scene)),
                         ('assets_qa', validate_assets(scene, assets, ROOT / 'planC/assets', final=False))]:
        (reports / (name + '.json')).write_text(report.model_dump_json(indent=2))
        if not report.passed:
            raise SystemExit(f'{name}: failed; see {reports}')
    prefix = [args.blender, '--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python']

    def run(script, flags, log):
        print(f'{script} → {log.name}', flush=True)
        with log.open('w') as stream:
            subprocess.run([*prefix, str(ROOT / 'planC/blender' / script), '--', *flags],
                           stdout=stream, stderr=subprocess.STDOUT, cwd=ROOT, check=True, timeout=7200)

    build_ok = False
    if (out / 'build_manifest.json').is_file():
        build_ok = validate_build(scene, out, source_path=source, asset_manifest_path=assets_path).passed
        build_manifest = json.loads((out / 'build_manifest.json').read_text())
        expected_script = sha256_file(ROOT / 'planC/blender/build_scene.py')
        expected_importer = sha256_file(ROOT / 'planC/blender/import_assets.py')
        build_ok = (build_ok and build_manifest.get('builder_script_sha256') == expected_script
                    and build_manifest.get('asset_importer_sha256') == expected_importer)
    if args.rebuild or not build_ok:
        run('build_scene.py', ['--scene', str(source), '--assets', str(assets_path), '--output', str(out),
                               '--asset-root', str(ROOT / 'planC/assets')], out / 'build.log')
    build_report = validate_build(scene, out, source_path=source, asset_manifest_path=assets_path)
    (reports / 'build_qa.json').write_text(build_report.model_dump_json(indent=2))
    if not build_report.passed:
        raise SystemExit('Build QA failed')
    manifest = json.loads((out / 'build_manifest.json').read_text())
    (out / 'renders').mkdir(exist_ok=True)
    for rid in args.rooms:
        # Keep the entrance image at review quality even in a quick whole-home run.
        still_profile = 'draft_still_4k' if args.high_resolution else 'review' if rid == 'living' else args.still_profile
        profiles = [('still', still_profile, 'still-4k' if args.high_resolution else 'review')]
        if args.panorama:
            profiles.append(('360', 'panorama_8k_preview' if args.high_resolution else 'panorama_preview', '360-8k' if args.high_resolution else '360'))
        for suffix, profile, filename in profiles:
            camera = f'camera_{rid}_{suffix}'
            image = out / 'renders' / f'{rid}-{filename}.png'
            rmanifest = image.with_suffix('.manifest.json')
            if rmanifest.is_file():
                result = validate_render(scene, image, json.loads(rmanifest.read_text()),
                                         build_id=manifest['build_id'], profile=profile, camera_id=camera,
                                         source_hash=manifest['scene_hash'], blend_hash=manifest['project_blend_sha256'])
                if result.passed and json.loads(rmanifest.read_text()).get('render_script_sha256') == sha256_file(ROOT / 'planC/blender/render_scene.py'):
                    print(f'Verified existing {image.name}', flush=True)
                    continue
            run('render_scene.py', ['--blend', str(out / 'project.blend'), '--camera', camera,
                                    '--profile', profile, '--output', str(image)], out / f'{rid}-{filename}.log')
            result = validate_render(scene, image, json.loads(rmanifest.read_text()), build_id=manifest['build_id'],
                                     profile=profile, camera_id=camera, source_hash=manifest['scene_hash'],
                                     blend_hash=manifest['project_blend_sha256'])
            (reports / f'{rid}-{filename}_qa.json').write_text(result.model_dump_json(indent=2))
            if not result.passed:
                raise SystemExit(f'Render QA failed: {image}')
        # Make each completed room reviewable without waiting for the full batch.
        subprocess.run([sys.executable, str(ROOT / 'planC/scripts/export_site.py'), '--build', str(out)], check=True)
    subprocess.run([sys.executable, str(ROOT / 'planC/scripts/export_site.py'), '--build', str(out)], check=True)


if __name__ == '__main__':
    main()
