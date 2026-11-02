"""Reopen a built .blend and inspect real datablocks, independent of build claims."""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys
import bpy


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--blend',required=True)
    p.add_argument('--output',required=True)
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
    path=Path(a.blend).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    source=json.loads(scene['source_scene_json'])
    actual={}
    for obj in scene.objects:
        if obj.get('scene_id'):actual.setdefault(obj['scene_id'],[]).append(obj.name)
    expected={obj['id'] for group in ['walls','openings','rooms','objects','lights','cameras'] for obj in source.get(group,[])}
    missing=sorted(expected-set(actual))
    duplicates={}
    finish_counts={}
    for role in ['floor','ceiling']:
        cells=[]
        for obj in scene.objects:
            if obj.get('architecture_role')!=role:continue
            for face in obj.data.polygons:
                cell=tuple(sorted(tuple(round(v,8) for v in obj.data.vertices[i].co) for i in face.vertices))
                cells.append(cell)
        counts=Counter(cells)
        duplicates[role]=sum(count-1 for count in counts.values() if count>1)
        finish_counts[role]=len(cells)
    cameras={}
    for c in source['cameras']:
        obj=bpy.data.objects[c['id']]
        cameras[c['id']]={'type':obj.data.type,'panorama_type':getattr(obj.data,'panorama_type',None) if obj.data.type=='PANO' else None}
    missing_textures=[]
    for image in bpy.data.images:
        if image.source=='FILE' and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).is_file():missing_textures.append(image.name)
    problems=[]
    if missing:problems.append('Scene IDs missing from actual Blender datablocks')
    if any(duplicates.values()):problems.append('Coincident finish cells')
    if missing_textures:problems.append('Missing external texture')
    if scene.unit_settings.scale_length!=1:problems.append('Blender world scale is not one metre')
    result={'status':'fail' if problems else 'pass','inspection':'reopened_blender_datablocks',
            'scene_revision':scene['scene_revision'],'scene_hash':scene['scene_hash'],'build_id':scene['build_id'],
            'project_blend_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'expected_source_entity_count':len(expected),'actual_source_entity_count':len(actual),
            'missing_scene_ids':missing,'coincident_finish_cells':duplicates,'finish_cell_counts':finish_counts,
            'missing_textures':missing_textures,'camera_projections':cameras,'problems':problems,
            'scope':'Technical scene consistency only; production geometry/asset approval remains separate.'}
    output=Path(a.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result))
    if problems:raise ValueError('; '.join(problems))


if __name__=='__main__':main()
