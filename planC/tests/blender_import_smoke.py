"""Exercise the local .blend/.glb importer with a labelled test box asset.

This is a technical import fixture, never a production furniture asset.
"""
from pathlib import Path
import hashlib
import json
import sys
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'planC/blender'))
from import_assets import import_registered, verify
out=ROOT/'planC/outputs/tests/local-import'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_cube_add(size=1)
model=bpy.context.object
model.name='technical_fixture_box_not_furniture'
model.dimensions=(1.4,.5,.7)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mat=bpy.data.materials.new('technical_fixture_pbr');mat.use_nodes=True
model.data.materials.append(mat)
blend=out/'fixture.blend';glb=out/'fixture.glb'
bpy.data.libraries.write(str(blend),{model})
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True)
evidence=[]
for path in [blend,glb]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    parent=bpy.data.objects.new('imported_fixture_parent',None)
    bpy.context.collection.objects.link(parent)
    asset={'asset_id':'local_import_test','file_uri':path.name,'file_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
           'quality_tier':'custom_fixture','license':{'license_id':'project_authored_technical_test','commercial_use_allowed':True}}
    imported=import_registered(asset,out,parent,[1.4,.5,.7],'import_test',1)
    bpy.context.view_layer.update()
    meshes=[o for o in imported if o.type=='MESH']
    assert meshes and all(o.data.materials for o in meshes)
    corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    low=[min(v[i] for v in corners) for i in range(3)];high=[max(v[i] for v in corners) for i in range(3)]
    size=[high[i]-low[i] for i in range(3)]
    assert all(abs(a-b)<1e-5 for a,b in zip(size,[1.4,.5,.7])),size
    assert abs(low[2])<1e-5,low
    assert all(o.get('scene_id')=='import_test' for o in imported)
    for bad in [{**asset,'file_sha256':'0'*64},
                {**asset,'file_uri':'../outside.blend'},
                {**asset,'license':{'license_id':'denied','commercial_use_allowed':False}}]:
        try:verify(bad,out)
        except ValueError:pass
        else:raise AssertionError('Rejected asset unexpectedly passed')
    evidence.append({'format':path.suffix,'imported_meshes':len(meshes),'size_m':size,'bottom_z_m':low[2],
                     'sha_mismatch_rejected':True,'path_escape_rejected':True,'noncommercial_rejected':True})
result={'status':'pass','blender_version':bpy.app.version_string,'test':'local_asset_import_and_permission_gates',
        'asset_quality':'technical_fixture_only','evidence':evidence}
(out/'result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
