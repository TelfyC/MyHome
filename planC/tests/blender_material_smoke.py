"""Real bpy regression: Scene color/PBR bindings change, detail wood stays intact.

Run: blender --background --factory-startup --disable-autoexec --python-exit-code 1
      --python planC/tests/blender_material_smoke.py
The test reopens its actual .blend artifact before asserting persisted bindings.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import bpy

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'planC/blender'))
import build_scene as builder

out=ROOT/'planC/outputs/tests/material-binding'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
source={
    'materials':[
        {'id':'test_red','base_color':'#ff0000','roughness':.21,'metallic':.07,'texture_repeat_m':[.8,.3]},
        {'id':'test_blue','base_color':[0.0,0.0,1.0],'roughness':.82,'metallic':.13,'texture_repeat_m':[.4,.2]},
    ],
    'levels':[{'id':'test_level','elevation_m':0,'ceiling_height_m':2.7}],
    'walls':[{'id':'test_wall','level_id':'test_level','path_xy_m':[[0,0],[0,4]],'height_m':2.7,'thickness_m':.2,'material_id':'test_red'}],
    'rooms':[{'id':'test_room','level_id':'test_level','boundary_xy_m':[[0,0],[4,0],[4,4],[0,4]],'floor_material_id':'test_blue'}],
    'objects':[
        {'id':'sofa_before','category':'sofa','asset_id':'custom_sofa','material_id':'test_red','dimensions_m':[2.2,.88,.84],
         'transform':{'position_m':[0,0,0]}},
        {'id':'sofa_after','category':'sofa','asset_id':'custom_sofa','material_id':'test_blue','dimensions_m':[2.2,.88,.84],
         'transform':{'position_m':[3,0,0]}},
    ],
}
assets={'assets':[{'asset_id':'custom_sofa','category':'sofa','generator':'sofa','quality_tier':'custom_fixture'}]}
(out/'scene_material_fixture.json').write_text(json.dumps(source,indent=2))
builder.make_materials(source)
builder.REVISION=1
builder.create_architecture(source)
builder.create_furniture(source,assets,ROOT/'planC/assets')
blend=out/'materials.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.wm.open_mainfile(filepath=str(blend),load_ui=False,use_scripts=False)
assert all(o.data.materials[0].name=='test_red' for o in bpy.data.objects if o.get('scene_id')=='test_wall' and 'wall segment' in o.name)
assert next(o for o in bpy.data.objects if o.name=='test_room::floor').data.materials[0].name=='test_blue'
observed={'architecture':{'wall_material_id':'test_red','floor_material_id':'test_blue'}}
for oid,material_id,color,roughness,metallic in [
    ('sofa_before','test_red',[1,0,0],.21,.07),
    ('sofa_after','test_blue',[0,0,1],.82,.13),
]:
    primary=[];legs=[]
    for obj in bpy.data.objects:
        if obj.get('scene_id')!=oid or not hasattr(obj.data,'materials'):continue
        if obj.get('material_role')=='primary':
            assert all(mat.name==material_id for mat in obj.data.materials),obj.name
            primary.append(obj.name)
        if 'tapered oak foot' in obj.name:
            assert obj.data.materials[0].name=='oak',obj.name
            legs.append(obj.name)
    assert primary and len(legs)==4
    mat=bpy.data.materials[material_id]
    shader=mat.node_tree.nodes.get('Principled BSDF')
    actual=list(shader.inputs['Base Color'].default_value)[:3]
    assert all(abs(a-b)<1e-6 for a,b in zip(actual,color)),actual
    assert abs(shader.inputs['Roughness'].default_value-roughness)<1e-6
    assert abs(shader.inputs['Metallic'].default_value-metallic)<1e-6
    observed[oid]={'primary_material_id':material_id,'primary_part_count':len(primary),
                   'preserved_oak_feet':len(legs),'actual_linear_base_color':actual,
                   'actual_roughness':float(shader.inputs['Roughness'].default_value),
                   'actual_metallic':float(shader.inputs['Metallic'].default_value)}
assert observed['sofa_before']['actual_linear_base_color']!=observed['sofa_after']['actual_linear_base_color']
# Color transfer itself must decode sRGB, not pass byte values into linear shader inputs.
assert abs(builder.parse_color('#808080')[0]-.2158605001)<1e-8
for invalid in ['red','#abc','#xx0000',[1,float('nan'),0],[2,0,0]]:
    try:builder.parse_color(invalid)
    except (ValueError,TypeError):pass
    else:raise AssertionError(f'Invalid color accepted: {invalid}')
result={'status':'pass','blender_version':bpy.app.version_string,'test':'scene_material_primary_slots_persist_after_reopen',
        'builder_script_sha256':hashlib.sha256((ROOT/'planC/blender/build_scene.py').read_bytes()).hexdigest(),
        'blend_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'evidence':observed}
(out/'result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
