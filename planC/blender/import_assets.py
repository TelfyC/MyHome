"""Local audited asset importer. No downloads, external commands or scripts."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import bpy
from mathutils import Vector


def resolve_local(uri, root):
    if "://" in uri:
        if not uri.startswith("asset://"):
            raise ValueError("Only local asset:// paths are allowed")
        uri=uri[len("asset://"):]
    path=(root/uri).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Asset path leaves registered asset root")
    if not path.is_file():raise ValueError("Asset file missing")
    return path


def verify(asset, root):
    lic=asset.get("license",{})
    if lic.get("commercial_use_allowed") is not True or not lic.get("license_id"):
        raise ValueError("Asset permission evidence missing")
    path=resolve_local(asset["file_uri"],root)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=asset.get("file_sha256"):
        raise ValueError("Asset content SHA256 differs from registration")
    if path.suffix.lower() not in {".blend",".glb",".gltf",".obj",".fbx"}:
        raise ValueError("Unsupported asset format")
    if path.suffix.lower()==".gltf":
        payload=json.loads(path.read_text())
        for resource in payload.get("buffers",[])+payload.get("images",[]):
            uri=resource.get("uri","")
            if uri and not uri.startswith("data:"):
                resolve_local(str(path.parent.relative_to(root)/uri),root)
    for texture in asset.get("textures",[]):
        file=resolve_local(texture["file_uri"],root)
        if texture.get("file_sha256") and hashlib.sha256(file.read_bytes()).hexdigest()!=texture["file_sha256"]:
            raise ValueError("Texture content SHA256 differs from registration")
    return path


def import_registered(asset, root, parent, expected_size, scene_id, revision):
    path=verify(asset,root)
    before=set(bpy.data.objects)
    suffix=path.suffix.lower()
    if suffix==".blend":
        # Loading object datablocks does not invoke Text/Python modules.
        with bpy.data.libraries.load(str(path),link=False) as (src,dst):
            dst.objects=list(src.objects)
        for obj in dst.objects:
            if obj is not None and obj.name not in bpy.context.scene.objects:
                bpy.context.collection.objects.link(obj)
    elif suffix in {".gltf",".glb"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix==".obj":
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        bpy.ops.import_scene.fbx(filepath=str(path),use_anim=False)
    imported=[o for o in bpy.data.objects if o not in before]
    meshes=[o for o in imported if o.type=="MESH"]
    if not meshes:raise ValueError("Imported asset contains no renderable mesh")
    kept=[]
    for obj in imported:
        if obj.type not in {"MESH","EMPTY","CURVE","ARMATURE"}:
            bpy.data.objects.remove(obj,do_unlink=True)
        else:
            kept.append(obj)
    imported=kept
    for obj in meshes:
        if len(obj.data.polygons)==0:raise ValueError("Imported mesh has no polygons")
        if not obj.data.materials:raise ValueError("Imported mesh has no assigned material")
        if not obj.data.uv_layers and asset.get("quality_tier")=="hero":
            raise ValueError("Hero asset requires inspected UV map")
        for mat in obj.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=="TEX_IMAGE":
                        image=node.image
                        if image is None:raise ValueError("Imported material has an unbound texture")
                        if not image.packed_file and image.source=="FILE":
                            image_path=Path(bpy.path.abspath(image.filepath)).resolve()
                            if not image_path.is_relative_to(root.resolve()) or not image_path.is_file():
                                raise ValueError("Imported texture missing or outside asset root")
                            image.pack()
    bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    low=Vector([min(v[i] for v in corners) for i in range(3)])
    high=Vector([max(v[i] for v in corners) for i in range(3)])
    actual=high-low
    if min(actual)<.00001:raise ValueError("Imported asset bounds are degenerate")
    ratios=[expected_size[i]/actual[i] for i in range(3)]
    if max(ratios)/min(ratios)>1.15:
        raise ValueError("Registered asset dimensions do not match requested shape; refused nonuniform distortion")
    ratio=min(ratios)
    center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    # A normalization empty preserves hierarchy and applies uniform metric scale.
    normalization=bpy.data.objects.new(scene_id+"::asset normalization",None)
    bpy.context.collection.objects.link(normalization)
    normalization.parent=parent
    normalization.scale=(ratio,)*3
    normalization.location=-center*ratio
    for obj in imported:
        if obj.parent not in imported:
            matrix=obj.matrix_world.copy()
            obj.parent=normalization
            obj.matrix_basis=matrix
        obj["scene_id"]=scene_id
        obj["asset_id"]=asset["asset_id"]
        obj["source_revision"]=revision
    normalization["scene_id"]=scene_id
    return imported+[normalization]
