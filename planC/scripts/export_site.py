"""Publish verified local Blender artifacts into the existing static site.

Never substitutes old/AI renders. Only matching scene/build/camera/hash artifacts
are advertised. Missing views remain null in the public project manifest.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'planC'))
from archviz.models import SceneSnapshot, AssetManifest, QAReport
from archviz.constraints import validate_geometry
from archviz.assets import validate_assets
from archviz.qa import validate_build, validate_render

ROOMS = [
    ('living', '起居室', 'LIVING', '棉麻沙发、低矮木柜与窗边绿植，让日光有落脚的地方。', '约 3.30 m 主段净宽'),
    ('dining', '餐厅与阳台', 'DINING', '白色桌面、细木餐椅，北端阳台安放咖啡与植物。', '约 2.50 m 餐厅净宽'),
    ('master', '主卧', 'MASTER BEDROOM', '浅木床架、暖白柜体与亚麻床品，安静地休息。', '约 3.25 m 参考净宽'),
    ('guest', '次卧 / 书房', 'BEDROOM & STUDY', '一张床、一张书桌，让读书和休息自然相邻。', '图示约 3.20 × 3.95 m'),
    ('study', '多功能卧室', 'FLEXIBLE ROOM', '保留原图卧室的完整边界，布置休息与工作。', '图示约 2.75 × 3.90 m'),
    ('kitchen', '厨房', 'KITCHEN', '保留原厨房位置，浅木与暖白组织备餐、清洗与储物。', '图示约 2.15 × 2.90 m'),
    ('bathroom', '原图卫浴区', 'BATHROOM', '卫浴沿原图上侧位置布置，隐私隔断与排水仍待确认。', '原图分区推断'),
]


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preflight(scene_path, assets_path, build_directory, asset_root):
    """Read and validate the complete export before touching published files."""
    raw_scene = read(scene_path)
    scene = SceneSnapshot.model_validate(raw_scene)
    assets = AssetManifest.model_validate(read(assets_path))
    scene_hash = sha(scene_path)
    assets_hash = sha(assets_path)
    geometry = validate_geometry(scene)
    assets_preview = validate_assets(scene, assets, asset_root, final=False)
    if not geometry.passed or not assets_preview.passed:
        raise ValueError('Input geometry or asset QA failed; existing published project is preserved')
    build_path = build_directory / 'build_manifest.json'
    build = read(build_path) if build_path.is_file() else None
    candidates = []
    if build:
        report = validate_build(scene, build_directory, source_path=scene_path, asset_manifest_path=assets_path)
        if not report.passed:
            raise ValueError('Build QA failed: ' + report.model_dump_json())
        if build.get('scene_glb_sha256'):
            glb = build_directory / 'scene.glb'
            if not glb.is_file() or sha(glb) != build['scene_glb_sha256']:
                raise ValueError('Artifact SHA256 mismatch: scene.glb')
        resolved = build_directory / 'scene_resolved.json'
        if resolved.is_file() and sha(resolved) != scene_hash:
            raise ValueError('VERSION_001: resolved Scene snapshot differs from current source')
        stale_count = 0
        for manifest_path in sorted((build_directory / 'renders').glob('*.manifest.json')):
            manifest = read(manifest_path)
            if (manifest.get('scene_revision') != scene.revision or manifest.get('scene_hash') != scene_hash
                    or manifest.get('build_id') != build['build_id']):
                stale_count += 1
                continue  # leave old-build renders unadvertised during an incremental batch
            image_name = manifest.get('image_uri')
            if not isinstance(image_name, str) or not image_name or Path(image_name).name != image_name:
                raise ValueError('RENDER_002: render image must be a filename within its render directory')
            image = manifest_path.parent / image_name
            report = validate_render(scene, image, manifest, build_id=build['build_id'],
                                     profile=manifest.get('render_profile_id'), source_hash=scene_hash,
                                     blend_hash=build['project_blend_sha256'])
            if not report.passed:
                raise ValueError('Render QA failed: ' + report.model_dump_json())
            candidates.append((manifest_path, image, manifest))
        if stale_count and not candidates:
            raise ValueError('VERSION_001: no render matches the current build; existing published project is preserved')
    return raw_scene, scene, assets, scene_hash, assets_hash, build, geometry, assets_preview, candidates


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--build', type=Path, default=ROOT / 'planC/outputs/home1_sunlit/r1')
    p.add_argument('--scene', type=Path, default=ROOT / 'planC/data/sunlit/scene.json')
    p.add_argument('--assets', type=Path, default=ROOT / 'planC/data/sunlit/asset_manifest.json')
    p.add_argument('--asset-root', type=Path, default=ROOT / 'planC/assets')
    p.add_argument('--destination', type=Path, default=ROOT / 'public/plan-c')
    args = p.parse_args()
    (raw_scene, scene, assets, scene_hash, assets_hash, build,
     geometry, assets_preview, candidates) = preflight(args.scene, args.assets, args.build, args.asset_root)
    dest = args.destination.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    artifacts = []

    def copy(source, path, label=None, expected_hash=None):
        if expected_hash and sha(source) != expected_hash:
            raise ValueError(f'Artifact SHA256 mismatch: {source}')
        target = dest / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        if label:
            artifacts.append({'label': label, 'path': path, 'size': target.stat().st_size})

    copy(args.scene, 'scene.json', 'Scene JSON · 场景事实源', scene_hash)
    common = {key: raw_scene[key] for key in ['schema_version', 'project_id', 'revision', 'units']}
    common['source_scene_sha256'] = scene_hash
    write(dest / 'scene_structure.json', {**common, **{key: raw_scene[key] for key in
          ['coordinate_system', 'site', 'source_plan', 'levels', 'walls', 'openings', 'rooms', 'constraints'] if key in raw_scene}})
    write(dest / 'scene_design.json', {**common, **{key: raw_scene[key] for key in
          ['objects', 'materials', 'lights', 'cameras', 'metadata'] if key in raw_scene}})
    artifacts.extend([{'label': '结构快照 · 墙体、洞口与来源', 'path': 'scene_structure.json'},
                      {'label': '设计快照 · 布局、材质、灯光与相机', 'path': 'scene_design.json'}])
    copy(args.assets, 'asset_manifest.json', '资产目录 · 自建预览资产与来源', assets_hash)
    copy(ROOT / 'docs/方案B/home1.png', 'home1.png', '原始户型图 · home1.png')
    uncertain_path = args.scene.parent / 'uncertainties.json'
    uncertainties = read(uncertain_path) if uncertain_path.exists() else []
    write(dest / 'reports/uncertainties.json', uncertainties)
    artifacts.append({'label': '待确认项 · 尺寸、墙体、光照与资产', 'path': 'reports/uncertainties.json'})
    assets_final = validate_assets(scene, assets, args.asset_root, final=True)
    geometry_final = validate_geometry(scene, final=True)
    write(dest / 'reports/geometry_qa.json', geometry.model_dump(mode='json'))
    write(dest / 'reports/assets_qa.json', assets_preview.model_dump(mode='json'))
    final_gate = QAReport.from_issues(scene, [*geometry_final.issues, *assets_final.issues])
    write(dest / 'reports/production_gate.json', final_gate.model_dump(mode='json'))
    artifacts.append({'label': '几何检查报告', 'path': 'reports/geometry_qa.json'})
    artifacts.append({'label': '正式交付门禁报告', 'path': 'reports/production_gate.json'})
    if build:
        copy(args.build / 'project.blend', 'project.blend', 'Blender 工程 · 可编辑真实三维', build['project_blend_sha256'])
        copy(args.build / 'build_manifest.json', 'build_manifest.json', '构建记录 · 版本与哈希')
        copy(args.build / 'inspection.json', 'inspection.json', '对象映射 · JSON → Blender')
        if build.get('scene_glb_sha256'):
            copy(args.build / 'scene.glb', 'scene.glb', '三维结构 · GLB 模型', build['scene_glb_sha256'])
        if (args.build / 'scene_resolved.json').is_file():
            copy(args.build / 'scene_resolved.json', 'scene_resolved.json', '构建使用的 Scene 快照', scene_hash)
        reopened = args.build / 'reports/blender_reopen_qa.json'
        if reopened.is_file():
            evidence = read(reopened)
            if (evidence.get('build_id') == build['build_id']
                    and evidence.get('project_blend_sha256') == build['project_blend_sha256']):
                copy(reopened, 'reports/blender_reopen_qa.json', '工程重开检查 · 实体、饰面与相机')

    views = []
    published_renders = []
    for manifest_path, image, manifest in candidates:
        rel = 'renders/' + image.name
        copy(image, rel)
        copy(manifest_path, 'renders/' + manifest_path.name)
        published_renders.append({**manifest, 'public_path': rel})
    for rid, name, english, note, dimensions in ROOMS:
        def select(projection):
            options = [r for r in published_renders if r['camera_id'] == f'camera_{rid}_' + ('360' if projection == 'equirectangular' else 'still')
                       and r['projection'] == projection]
            return max(options, key=lambda r: r['resolution_px'][0])['public_path'] if options else None
        views.append({'id': rid, 'name': name, 'english': english, 'note': note, 'dimensions': dimensions,
                      'camera_id': f'camera_{rid}_still', 'still': select('perspective'), 'panorama': select('equirectangular')})
        pano_options = [r for r in published_renders if r['camera_id'] == f'camera_{rid}_360'
                        and r['projection'] == 'equirectangular']
        if pano_options:
            full = max(pano_options, key=lambda r: r['resolution_px'][0])
            mobile = min(pano_options, key=lambda r: r['resolution_px'][0])
            views[-1].update({'panorama_width': full['resolution_px'][0],
                              'panorama_mobile': mobile['public_path'],
                              'panorama_mobile_width': mobile['resolution_px'][0]})
    write(dest / 'reports/render_qa.json', {'project_id': scene.project_id, 'scene_revision': scene.revision,
                                         'scene_hash': scene_hash, 'build_id': build['build_id'] if build else None,
                                         'status': 'warning' if published_renders else 'not_run',
                                         'checks': 'Actual files decoded; dimensions, projection, SHA256 and scene/build/camera identity checked.',
                                         'visual_status': 'manual_review_required', 'renders': published_renders})
    artifacts.append({'label': '渲染校验与逐图记录', 'path': 'reports/render_qa.json'})
    g_hard = [i for i in geometry.issues if i.severity in ('blocker', 'error')]
    still_count = sum(bool(v['still']) for v in views)
    pano_count = sum(bool(v['panorama']) for v in views)
    project = {
        'project_id': scene.project_id, 'title': '日光花园 · Blender 真实三维首版',
        'style': '日光花园原木', 'revision': scene.revision, 'status': 'preview',
        'stage': 'LOOKDEV_PREVIEWED' if published_renders else 'BUILT' if build else 'DESIGN_READY',
        'engine': 'Blender 4.5.3 LTS · Cycles CPU', 'source_plan': 'home1.png',
        'build_id': build['build_id'] if build else None, 'scene_hash': scene_hash,
        'rendered_at': datetime.now(timezone.utc).isoformat(),
        'notices': ['本版用于看布局与风格，完整保留原图黑白墙。图示尺寸、层高和洞口形式仍有待复测项。',
                    '所有效果图与360°来自本页可下载的同一版 Blender 场景，未使用 AI 图片替代场景渲染。',
                    '家具为自建细化预览模型，专业资产审核尚未完成；正式交付状态保持未通过。',
                    '日光是视觉情境；未确认地理北向、经纬度和日期，不作为日照分析。'],
        'rooms': views, 'artifacts': artifacts,
        'pipeline': [
            {'id': 'source', 'label': '图纸与尺寸', 'status': 'needs_confirmation', 'detail': '按 home1.png 分段转录；原图注明比例估算。'},
            {'id': 'scene', 'label': '版本化场景', 'status': 'success', 'detail': f'r{scene.revision} · {len(scene.walls)} 段墙 · {len(scene.openings)} 个洞口 · {len(scene.objects)} 件设计对象'},
            {'id': 'geometry', 'label': '几何与布局检查', 'status': 'fail' if g_hard else 'warning', 'detail': f'{len(g_hard)} 个硬错误；估算尺寸、地理北向保留待确认项。'},
            {'id': 'build', 'label': 'Blender 真实构建', 'status': 'success' if build else 'pending', 'detail': f"{build['build_id']} · 可编辑工程与对象映射已保存" if build else '等待 Blender Worker'},
            {'id': 'renders', 'label': '场景渲染', 'status': 'preview' if published_renders else 'pending', 'detail': f'{still_count}/7 个空间效果 · {pano_count}/7 个360°；实际分辨率详见逐图记录。'},
            {'id': 'final', 'label': '正式交付验收', 'status': 'blocked', 'detail': '需要尺寸校准、洞口确认、专业 Hero 资产审核及最终视觉验收。'},
        ],
        'metrics': {'walls': len(scene.walls), 'openings': len(scene.openings), 'objects': len(scene.objects),
                    'cameras': len(scene.cameras), 'still_renders': still_count, 'panoramas': pano_count},
        'palette': [{'color': '#bb9b72', 'name': '细纹浅橡木'}, {'color': '#eee9db', 'name': '暖白'},
                    {'color': '#a6ae8b', 'name': '鼠尾草绿'}, {'color': '#dbd2bb', 'name': '天然棉麻'}],
    }
    write(dest / 'project.json', project)
    print(json.dumps({'project_id': scene.project_id, 'build_id': project['build_id'],
                      'stills': still_count, 'panoramas': pano_count, 'destination': str(dest)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
