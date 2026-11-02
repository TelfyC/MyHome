"""Deterministic, offline Blender builder. Run with Blender --background --python.

Scene JSON is the only geometry input. Built-in furniture is an explicitly
registered development/custom fixture, never a substitute for approved assets.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import random
import sys
import time
import shutil
from pathlib import Path

import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_assets import import_registered, verify

VERSION = "0.1.0"
MATS = {}
PARTS = {}
ACTIVE_ID = ""
ACTIVE_CATEGORY = None
# Explicit authoring roles: a material Patch changes the designed main surface,
# while fixture detail materials (metal feet, glass, leaves, screens) stay intact.
PRIMARY_PARTS = {
    "sofa": ("upholstered base", "seat cushion", "back cushion", "rounded upholstered arm"),
    "armchair": ("sage seat", "sage back"),
    "coffee_table": ("round table top", "rounded table top"),
    "dining_table": ("round table top", "rounded table top"),
    "dining_chair": ("woven seat pad", "curved oak back rest"),
    "chair": ("woven seat pad", "curved oak back rest"),
    "bed": ("mattress", "folded linen duvet", "bed pillow"),
    "bedside_table": ("cabinet case", "separate cabinet door", "solid top panel"),
    "cabinet": ("cabinet case", "separate cabinet door", "solid top panel"),
    "kitchen_run": ("cabinet case", "separate cabinet door", "upper cabinet"),
    "kitchen_cabinet": ("cabinet case", "separate cabinet door", "upper cabinet"),
    "fridge": ("refrigerator", "fridge door"),
    "plant": ("ceramic plant pot",),
    "rug": ("woven rug", "rug fringe"),
    "desk": ("round table top", "rounded table top"),
    "office_chair": ("office chair seat", "office chair back"),
    "toilet": ("ceramic toilet base", "toilet seat", "cistern"),
    "shower": ("shower tray",),
    "vanity": ("cabinet case", "separate cabinet door", "solid top panel", "vanity white counter", "ceramic basin", "basin inner bowl"),
    "pendant": ("pendant shade",),
    "bookcase": ("shelf upright", "bookshelf board"),
    "tv": ("television frame",),
}
ROOT = None
REVISION = 0


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def track(obj, name, mat=None):
    obj.name = f"{ACTIVE_ID}::{name}"
    obj["scene_id"] = ACTIVE_ID
    obj["source_revision"] = REVISION
    obj["builder_version"] = VERSION
    obj["material_role"] = "primary" if any(name.startswith(prefix) for prefix in PRIMARY_PARTS.get(ACTIVE_CATEGORY, ())) else "detail"
    if isinstance(mat, str):obj["fixture_material_name"] = mat
    if ROOT is not None:
        obj.parent = ROOT
    if mat:
        obj.data.materials.append(MATS[mat] if isinstance(mat, str) else mat)
        if isinstance(mat,str) and MATS[mat].get("scene_material_id"):
            obj["scene_material_id"]=mat
    PARTS.setdefault(ACTIVE_ID, []).append(obj.name)
    return obj


def bevel(obj, radius=.018, segments=3):
    modifier = obj.modifiers.new("Soft manufactured edges", "BEVEL")
    modifier.width = radius
    modifier.segments = segments
    obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj


def box(name, pos, dims, mat="oak", radius=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    track(obj, name, mat)
    if radius:
        bevel(obj, min(radius, min(dims)*.35))
    return obj


def cylinder(name, pos, radius, depth, mat="oak", vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = track(bpy.context.object, name, mat)
    bevel(obj, min(.009, depth*.1))
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return obj


def ellipsoid(name, pos, dims, mat="linen", rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=.5, location=pos)
    obj = track(bpy.context.object, name, mat)
    obj.scale = dims
    if rotation:
        obj.rotation_euler = rotation
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def rod(name, a, b, radius, mat="oak"):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a+b)*.5, radius, (b-a).length, mat, 20)
    obj.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    return obj


def curve(name, points, radius=.003, mat="linen", closed=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 8
    data.bevel_depth = radius
    data.bevel_resolution = 2
    spline = data.splines.new("POLY")
    spline.points.add(len(points)-1)
    for p, v in zip(spline.points, points):
        p.co = (*v, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return track(obj, name, mat)


def cushion(name, pos, dims, mat="linen", rotate=0):
    # Rounded cushion with piping; shape stays within object footprint.
    obj = box(name, pos, dims, mat, min(.105, dims[2]*.38))
    obj.rotation_euler[2] = rotate
    x,y,z = pos
    w,d,h = dims
    points=[]
    for cx,cy,start in [(w*.5-.045,d*.5-.045,0),(-w*.5+.045,d*.5-.045,90),(-w*.5+.045,-d*.5+.045,180),(w*.5-.045,-d*.5+.045,270)]:
        for i in range(7):
            ang=math.radians(start+i*15)
            dx=cx+.045*math.cos(ang)
            dy=cy+.045*math.sin(ang)
            points.append((x+dx*math.cos(rotate)-dy*math.sin(rotate),y+dx*math.sin(rotate)+dy*math.cos(rotate),z))
    curve(name+" stitched seam", points, .0025, mat, True)
    return obj


def offset_polygon(polygon, distance=.11):
    """Miter room finishes beneath wall centrelines without changing net room data."""
    points=list(polygon)
    signed=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
    if signed<0:points.reverse()
    result=[]
    for i,p in enumerate(points):
        a,b=points[i-1],points[(i+1)%len(points)]
        u=(p[0]-a[0],p[1]-a[1]);v=(b[0]-p[0],b[1]-p[1])
        lu=math.hypot(*u);lv=math.hypot(*v)
        n1=(u[1]/lu,-u[0]/lu);n2=(v[1]/lv,-v[0]/lv)
        denominator=1+n1[0]*n2[0]+n1[1]*n2[1]
        if abs(denominator)<1e-6:raise ValueError("Cannot offset reversing room edge")
        result.append((p[0]+distance*(n1[0]+n2[0])/denominator,p[1]+distance*(n1[1]+n2[1])/denominator))
    return result


def partition_room_finishes(rooms):
    """Non-overlapping rectilinear finishes, grouped by level and source room.

    Coplanar overlapping Solidify shells produce black Cycles self-intersections.
    A shared XY grid assigns each finish cell once, then stitches each owner's
    cells into one mesh. The Scene net room polygons remain untouched.
    """
    partitions={r["id"]: {"vertices":[],"faces":[]} for r in rooms}
    for level in sorted({r["level_id"] for r in rooms}):
        candidates=[]
        for room in rooms:
            if room["level_id"]!=level:continue
            poly=room["boundary_xy_m"]
            if poly[0]==poly[-1]:poly=poly[:-1]
            if any(abs(a[0]-b[0])>1e-8 and abs(a[1]-b[1])>1e-8 for a,b in zip(poly,poly[1:]+poly[:1])):
                raise ValueError("Phase 1 finish partition requires rectilinear room boundaries; unsupported diagonal room must be reviewed")
            candidates.append((room["id"],offset_polygon(poly,.11)))
        xs=sorted({round(p[0],9) for _,poly in candidates for p in poly})
        ys=sorted({round(p[1],9) for _,poly in candidates for p in poly})
        indices={rid:{} for rid,_ in candidates}
        def inside(point,poly):
            x,y=point;result=False
            for a,b in zip(poly,poly[1:]+poly[:1]):
                if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
            return result
        for x1,x2 in zip(xs[:-1],xs[1:]):
            if x2-x1<1e-8:continue
            for y1,y2 in zip(ys[:-1],ys[1:]):
                if y2-y1<1e-8:continue
                center=((x1+x2)/2,(y1+y2)/2)
                owner=next((rid for rid,poly in candidates if inside(center,poly)),None)
                if owner is None:continue
                partition=partitions[owner];index=indices[owner];face=[]
                for point in [(x1,y1),(x2,y1),(x2,y2),(x1,y2)]:
                    if point not in index:
                        index[point]=len(partition["vertices"])
                        partition["vertices"].append(point)
                    face.append(index[point])
                partition["faces"].append(face)
    return partitions


def partition_surface(name, partition, z, mat, thickness=.1, offset=-1):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(x,y,z) for x,y in partition["vertices"]],[],partition["faces"])
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    track(obj,name,mat)
    modifier=obj.modifiers.new("Continuous finish slab", "SOLIDIFY")
    modifier.thickness=thickness;modifier.offset=offset
    obj["finish_overlap_under_wall_m"]=.11
    obj["finish_partition_method"]="unique_xy_cell_owner"
    return obj


def surface(name, polygon, z, mat, thickness=.1, offset=-1):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(x,y,z) for x,y in polygon], [], [tuple(range(len(polygon)))])
    mesh.update()
    obj=bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    track(obj,name,mat)
    if thickness:
        solid=obj.modifiers.new("Slab thickness", "SOLIDIFY")
        solid.thickness=thickness
        solid.offset=offset
    return obj


def material(name, color, roughness=.5, metallic=0, kind=None, repeat_m=None):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    bs=nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*color,1)
    bs.inputs["Roughness"].default_value=roughness
    bs.inputs["Metallic"].default_value=metallic
    tex=nodes.new("ShaderNodeTexCoord")
    if kind in ("wood", "cloth", "plaster"):
        mapping=nodes.new("ShaderNodeVectorMath")
        mapping.operation="MULTIPLY"
        mapping.inputs[1].default_value={"wood":(2,115,5),"cloth":(180,180,180),"plaster":(48,48,48)}[kind]
        if repeat_m is not None:
            sx,sy=repeat_m
            mapping.inputs[1].default_value={"wood":(1/sx,18/sy,5),"cloth":(180/sx,180/sy,180),"plaster":(48/sx,48/sy,48)}[kind]
        links.new(tex.outputs["Object"],mapping.inputs[0])
        noise=nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value=1
        noise.inputs["Detail"].default_value=3
        noise.inputs["Roughness"].default_value=.7
        links.new(mapping.outputs["Vector"],noise.inputs["Vector"])
        ramp=nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position=.17
        ramp.color_ramp.elements[1].position=.83
        low_factor,high_factor=(.97,1.03) if kind=="plaster" else (.72,1.12)
        ramp.color_ramp.elements[0].color=(*(c*low_factor for c in color),1)
        ramp.color_ramp.elements[1].color=(*(min(1,c*high_factor) for c in color),1)
        links.new(noise.outputs["Fac"],ramp.inputs[0])
        links.new(ramp.outputs["Color"],bs.inputs["Base Color"])
        bump=nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value=.19 if kind=="wood" else .27
        bump.inputs["Distance"].default_value=.001 if kind=="cloth" else .00025 if kind=="plaster" else .0008
        links.new(noise.outputs["Fac"],bump.inputs["Height"])
        links.new(bump.outputs["Normal"],bs.inputs["Normal"])
        if kind=="cloth":
            bs.inputs["Sheen Weight"].default_value=.3
            bs.inputs["Sheen Roughness"].default_value=.7
    MATS[name]=mat
    return mat


def make_materials(scene):
    material("oak",(.56,.39,.23),.48,kind="wood")
    material("oak_light",(.66,.49,.31),.48,kind="wood")
    material("oak_dark",(.4,.255,.13),.51,kind="wood")
    material("wall",(.84,.83,.77),.77,kind="plaster")
    material("ceiling",(.86,.85,.79),.85,kind="plaster")
    material("white",(.87,.855,.80),.36)
    material("linen",(.70,.65,.53),.86,kind="cloth")
    material("ivory",(.85,.81,.70),.89,kind="cloth")
    material("sage",(.30,.39,.25),.86,kind="cloth")
    material("stripe",(.48,.48,.33),.85,kind="cloth")
    material("metal",(.045,.055,.044),.32,.65)
    material("brass",(.47,.33,.16),.3,.7)
    material("leaf",(.09,.25,.065),.5)
    MATS["leaf"].node_tree.nodes.get("Principled BSDF").inputs["Subsurface Weight"].default_value=.08
    material("leaf_light",(.19,.34,.09),.55)
    material("soil",(.06,.035,.018),1)
    material("ceramic",(.63,.55,.42),.35)
    material("tile",(.62,.61,.54),.6,kind="plaster")
    material("screen",(.012,.023,.025),.17,.2)
    material("paper",(.68,.63,.52),.9)
    glass=material("glass",(.97,.99,1),.02)
    bs=glass.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Transmission Weight"].default_value=1
    bs.inputs["IOR"].default_value=1.45
    for item in scene.get("materials",[]):
        name=item["id"]
        color=parse_color(item.get("base_color", "#cccccc"))
        roughness=float(item.get("roughness", .5))
        metallic=float(item.get("metallic", 0))
        repeat=tuple(item.get("texture_repeat_m", [1,1]))
        if not all(math.isfinite(v) and 0<=v<=1 for v in [roughness,metallic]):
            raise ValueError(f"Invalid PBR parameter: {name}")
        if len(repeat)!=2 or not all(math.isfinite(v) and v>0 for v in repeat):
            raise ValueError(f"Invalid physical texture repeat: {name}")
        # Names choose only the development microtexture recipe; all PBR values
        # and physical repetition are read from the versioned Scene material.
        hint=name.lower()
        kind=item.get("procedural_kind")
        if kind is None:
            kind="wood" if any(s in hint for s in ["oak","wood"]) else "cloth" if any(s in hint for s in ["linen","sage","fabric"]) else "plaster" if any(s in hint for s in ["ivory","wall","plaster","tile"]) else None
        if kind not in {None,"wood","cloth","plaster"}:raise ValueError("Unsupported procedural material recipe")
        mat=material(name,color,roughness,metallic,kind,repeat)
        mat["scene_material_id"]=name
        mat["base_color_srgb"]=list(item.get("base_color")) if not isinstance(item.get("base_color"),str) and item.get("base_color") else item.get("base_color", "#cccccc")
        mat["source_material_json"]=json.dumps(item,sort_keys=True)
        mat["texture_repeat_m"]=repeat


def parse_color(value):
    """Scene base colors are sRGB; Principled inputs use linear RGB."""
    if isinstance(value,str):
        if len(value)!=7 or not value.startswith("#"):raise ValueError("Color must be #RRGGBB")
        try:rgb=[int(value[i:i+2],16)/255 for i in (1,3,5)]
        except ValueError:raise ValueError("Color must be #RRGGBB")
    else:rgb=list(value)
    if len(rgb)!=3 or not all(isinstance(v,(int,float)) and math.isfinite(v) and 0<=v<=1 for v in rgb):
        raise ValueError("RGB channels must be finite in [0,1]")
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def bind_primary_material(item, asset, generator):
    material_id=item.get("material_id")
    if material_id is None:return
    if material_id not in MATS:raise ValueError(f"material_missing: {material_id}")
    changed=0
    declared_names=set(asset.get("primary_material_names", []))
    declared_roles=asset.get("material_roles", {})
    for name in PARTS[item["id"]]:
        obj=bpy.data.objects.get(name)
        if obj is None or not hasattr(obj.data,"materials"):continue
        for index,current in enumerate(obj.data.materials):
            primary=obj.get("material_role")=="primary" if generator else bool(current and (current.name in declared_names or declared_roles.get(current.name)=="primary"))
            if primary:
                obj.data.materials[index]=MATS[material_id]
                obj["scene_material_id"]=material_id
                obj["material_role"]="primary"
                changed+=1
    if not changed:raise ValueError(f"material_binding_missing: {item['id']} has no declared primary slots")
    ROOT["scene_material_id"]=material_id
    ROOT["primary_material_bindings"]=changed


def furniture_sofa(w,d,h):
    for x in [-w*.39,w*.39]:
        for y in [-d*.32,d*.32]:
            cylinder("tapered oak foot",(x,y,.10),.04,.20)
    box("oak underframe",(0,0,.22),(w*.92,d*.88,.12),"oak",.035)
    cushion("upholstered base",(0,0,.32),(w,d,.23),"ivory")
    for i in range(3):
        x=-w/3+i*w/3
        cushion(f"seat cushion {i}",(x,-d*.055,.49),(w/3-.028,d*.77,.23),"linen")
        back=cushion(f"back cushion {i}",(x,d*.33,h*.72),(w/3-.04,d*.24,h*.56),"ivory")
        back.rotation_euler[0]=-.10
    for x in [-w*.46,w*.46]:
        cushion("rounded upholstered arm",(x,0,h*.56),(w*.09,d*.93,h*.49),"ivory")
    for x,y,angle,col in [(-w*.29,d*.14,-.12,"sage"),(w*.28,d*.17,.12,"stripe")]:
        p=cushion("loose throw pillow",(x,y,h*.76),(w*.18,.15,h*.48),col)
        p.rotation_euler[0]=-.22
        p.rotation_euler[1]=angle


def furniture_armchair(w,d,h):
    for x in [-w*.36,w*.36]:
        for y in [-d*.34,d*.34]:
            rod("splayed chair leg",(x*1.1,y*1.1,.035),(x,y,.40),.026)
    box("chair seat support",(0,0,.37),(w*.9,d*.84,.055),"oak",.03)
    cushion("sage seat",(0,-d*.03,.47),(w*.83,d*.83,.19),"sage")
    back=cushion("sage back",(0,d*.33,h*.72),(w*.79,.15,h*.49),"sage")
    back.rotation_euler[0]=-.15
    for x in [-w*.46,w*.46]:
        rod("arm front post",(x,-d*.29,.35),(x,-d*.29,.65),.023)
        box("rounded oak arm",(x,-d*.015,.67),(.07,d*.91,.055),"oak",.025)


def furniture_table(w,d,h,white=False):
    if abs(w-d)<.06:
        cylinder("round table top",(0,0,h-.025),w/2,.05,"white" if white else "oak",72)
        for a in [0,120,240]:
            ang=math.radians(a)
            rod("splayed table leg",(.28*w*math.cos(ang),.28*w*math.sin(ang),.035),(.16*w*math.cos(ang),.16*w*math.sin(ang),h-.06),.035)
    else:
        box("rounded table top",(0,0,h-.025),(w,d,.05),"white" if white else "oak",.09)
        for x in [-w*.39,w*.39]:
            for y in [-d*.35,d*.35]:
                rod("table leg",(x*1.08,y*1.08,.025),(x,y,h-.05),.026)


def furniture_chair(w,d,h):
    for x in [-w*.34,w*.34]:
        for y in [-d*.32,d*.32]:
            rod("dining chair leg",(x*1.15,y*1.15,.025),(x,y,h*.49),.017)
    box("oak seat shell",(0,0,h*.48),(w*.9,d*.82,.04),"oak",.065)
    cushion("woven seat pad",(0,-d*.03,h*.53),(w*.81,d*.75,.07),"ivory")
    for x in [-w*.38,w*.38]:
        rod("back support",(x,d*.32,h*.47),(x,d*.36,h*.95),.017)
    back=box("curved oak back rest",(0,d*.36,h*.86),(w*.88,.055,h*.24),"oak",.04)
    back.rotation_euler[0]=-.08


def furniture_bed(w,d,h):
    box("oak bed plinth",(0,0,.19),(w,d,.28),"oak",.04)
    box("bed headboard",(0,d*.475,.57),(w,.09,1.05),"oak",.035)
    cushion("mattress",(0,-.02,.41),(w*.96,d*.96,.26),"ivory")
    # Quilted duvet has real wavy mesh and stitched strips.
    nx,ny=32,44
    verts=[]
    faces=[]
    for iy in range(ny+1):
        y=-d*.48+iy/ny*d*.72
        for ix in range(nx+1):
            x=-w*.48+ix/nx*w*.96
            z=.565+.014*math.sin(x*21+y*13)+.008*math.sin(y*35)+.022*math.sin(x*7)
            verts.append((x,y,z))
    for iy in range(ny):
        for ix in range(nx):
            k=iy*(nx+1)+ix
            faces.append((k,k+1,k+nx+2,k+nx+1))
    mesh=bpy.data.meshes.new("duvet")
    mesh.from_pydata(verts,[],faces)
    obj=bpy.data.objects.new("duvet",mesh)
    bpy.context.collection.objects.link(obj)
    track(obj,"folded linen duvet","linen")
    sol=obj.modifiers.new("duvet loft","SOLIDIFY");sol.thickness=.035
    for x in [-w*.23,w*.23]:
        cushion("bed pillow",(x,d*.30,.61),(w*.41,d*.20,.14),"ivory")
    box("sage folded throw",(0,-d*.30,.607),(w*.95,d*.24,.045),"sage",.015)


def furniture_cabinet(w,d,h,white=False):
    box("cabinet case",(0,0,h*.5),(w,d,h),"oak",.009)
    count=max(1,round(w/.48))
    for i in range(count):
        x=-w/2+(i+.5)*w/count
        box("separate cabinet door",(x,-d*.5-.007,h*.52),(w/count-.006,.021,h*.93),"white" if white else "oak",.003)
        box("recessed dark pull",(x+w/count*.32,-d*.5-.023,h*.75),(.014,.018,.12),"metal",.004)
    box("toe recess",(0,-d*.5-.002,.045),(w-.035,.012,.07),"oak_dark",0)
    box("solid top panel",(0,0,h+.012),(w+.025,d+.025,.025),"white" if white else "oak",.006)


def furniture_plant(w,d,h):
    pot_h=h*.26
    cylinder("ceramic plant pot",(0,0,pot_h*.5),w*.31,pot_h,"ceramic")
    cylinder("pot soil",(0,0,pot_h+.001),w*.285,.018,"soil")
    rng=random.Random(ACTIVE_ID)
    for i in range(7):
        a=i*2.399
        x=math.cos(a)*w*.22
        y=math.sin(a)*d*.22
        top=h*(.6+rng.random()*.34)
        rod("branch",(0,0,pot_h*.8),(x,y,top),.005,"leaf")
        for j in range(3):
            z=pot_h+(top-pot_h)*(.32+j*.29)
            length=w*(.32+rng.random()*.16)
            aa=a+j*.8
            dx,dy=math.cos(aa)*length,math.sin(aa)*length
            stem=(x*j/3,y*j/3,z)
            end=(stem[0]+dx,stem[1]+dy,z+.08)
            rod("leaf stalk",stem,end,.0025,"leaf")
            # Curved lanceolate leaf with raised midrib and fine silhouette.
            vs=[]
            for k in range(9):
                t=k/8
                width=math.sin(math.pi*t)*length*.22
                cx=stem[0]+dx*t;cy=stem[1]+dy*t
                zz=z+.08*t+.07*math.sin(math.pi*t)
                vs.extend([(cx-math.sin(aa)*width,cy+math.cos(aa)*width,zz-.02*math.sin(math.pi*t)),(cx,cy,zz),(cx+math.sin(aa)*width,cy-math.cos(aa)*width,zz-.02*math.sin(math.pi*t))])
            fs=[]
            for k in range(8):
                for v in [0,1]:
                    q=k*3+v;fs.append((q,q+1,q+4,q+3))
            mesh=bpy.data.meshes.new("leaf blade");mesh.from_pydata(vs,[],fs)
            ob=bpy.data.objects.new("leaf",mesh);bpy.context.collection.objects.link(ob)
            track(ob,"curved botanical leaf","leaf_light" if i%3==0 else "leaf")
            for p in mesh.polygons:p.use_smooth=True


def furniture_rug(w,d,h):
    box("woven rug",(0,0,.012),(w,d,.022),"ivory",.008)
    for side in [-1,1]:
        for i in range(36):
            x=-w*.47+i/35*w*.94
            curve("rug fringe",[(x,side*d*.49,.015),(x+.006,side*(d*.5+.025),.014)],.0015,"linen")


def furniture_kitchen(w,d,h):
    furniture_cabinet(w,d,min(.88,h),True)
    counter=.91
    box("white worktop",(0,0,counter),(w+.02,d+.02,.035),"white",.008)
    # Visible fixture details are deliberate custom models, not proxy blocks.
    sinkx=-w*.25
    box("sink black recess",(sinkx,-.02,counter+.02),(min(.52,w*.36),d*.66,.012),"metal",.035)
    box("sink basin inset",(sinkx,-.02,counter+.028),(min(.44,w*.3),d*.54,.01),"tile",.025)
    curve("gooseneck faucet",[(sinkx,.19,counter),(sinkx,.19,1.17),(sinkx,.17,1.25),(sinkx,.08,1.29),(sinkx,-.01,1.25),(sinkx,-.03,1.18)],.013,"metal")
    if w>1.4:
        cookx=w*.26
        box("induction ceramic hob",(cookx,0,counter+.025),(.58,d*.76,.018),"screen",.015)
        for xx in [-.15,.15]:
            for yy in [-.13,.13]:
                points=[(cookx+xx+.084*math.cos(k*math.tau/40),yy+.084*math.sin(k*math.tau/40),counter+.037) for k in range(40)]
                curve("hob ring",points,.0025,"metal",True)
    if h>1.55:
        for i in range(max(1,round(w/.5))):
            cw=w/max(1,round(w/.5))
            x=-w/2+(i+.5)*cw
            box("upper cabinet",(x,d*.14,1.87),(cw-.008,d*.65,.65),"white",.008)


def furniture_fridge(w,d,h):
    box("refrigerator",(0,0,h*.5),(w,d,h),"white",.035)
    for z,hh in [(h*.31,h*.59),(h*.80,h*.37)]:
        box("fridge door",(0,-d*.5-.013,z),(w*.96,.045,hh),"white",.025)
        box("vertical door pull",(w*.32,-d*.5-.055,z),(.018,.035,hh*.53),"metal",.006)


def furniture_bookcase(w,d,h):
    for x in [-w*.48,w*.48]:box("shelf upright",(x,0,h*.5),(.035,d,h),"oak",.003)
    for i in range(5):
        z=.08+i*(h-.12)/4
        box("bookshelf board",(0,0,z),(w,d,.025),"oak",.003)
        if i<4:
            for j in range(5):
                bw=.045+.014*(j%3)
                x=-w*.38+j*.074
                book=box("book",(x,-d*.08,z+.13),(bw,d*.65,.24-.02*(j%3)),"sage" if j%3==0 else "paper",.002)
                book.rotation_euler[1]=.03*(j%2)


def furniture_vanity(w,d,h):
    furniture_cabinet(w,d,h-.05,True)
    box("vanity white counter",(0,0,h-.025),(w+.02,d+.02,.055),"white",.012)
    ellipsoid("ceramic basin",(0,-.035,h+.055),(w*.61,d*.73,.13),"white")
    ellipsoid("basin inner bowl",(0,-.035,h+.09),(w*.51,d*.62,.045),"tile")
    curve("basin faucet",[(w*.23,d*.24,h),(w*.23,d*.24,h+.22),(w*.23,d*.10,h+.22)],.012,"metal")
    box("mirror glass",(0,d*.47,h+.65),(w*.85,.016,.8),"glass",.035)


def furniture_toilet(w,d,h):
    ellipsoid("ceramic toilet base",(0,0,h*.38),(w*.80,d*.75,h*.72),"white")
    ellipsoid("toilet seat",(0,-d*.10,h*.66),(w,d*.76,h*.18),"white")
    box("cistern",(0,d*.34,h*.67),(w*.83,d*.23,h*.62),"white",.06)
    box("flush button",(0,d*.33,h*.989),(w*.22,d*.12,.012),"metal",.008)


def furniture_shower(w,d,h):
    box("shower tray",(0,0,.035),(w,d,.07),"tile",.015)
    box("clear shower side",(w*.48,0,h*.5),(.012,d,h),"glass",.001)
    rod("shower riser",(0,d*.45,.6),(0,d*.45,h*.92),.014,"metal")
    rod("shower arm",(0,d*.45,h*.92),(0,d*.21,h*.92),.012,"metal")
    cylinder("rain shower head",(0,d*.21,h*.9),w*.15,.025,"metal")


def furniture_pendant(w,d,h):
    # Ground position may actually be ceiling contact, specified by Scene transform.
    rod("pendant cable",(0,0,h*.45),(0,0,h),.003,"metal")
    cylinder("pendant shade",(0,0,h*.30),w*.5,h*.27,"ivory")
    cylinder("shade lower rim",(0,0,h*.17),w*.5,.012,"oak")


def furniture_tv(w,d,h):
    box("television frame",(0,0,h*.55),(w,d*.7,h*.83),"metal",.012)
    box("television screen",(0,-d*.37,h*.55),(w*.965,.009,h*.79),"screen",.006)
    for x in [-w*.28,w*.28]:rod("TV foot",(x,-d*.7,.015),(x,0,h*.16),.01,"metal")


def furniture_desk(w,d,h):
    furniture_table(w,d,h,True)
    # Notebook, desk lamp and book stack are traceable parts of this fixture.
    box("notebook",(-w*.18,0,h+.02),(.30,.22,.025),"sage",.002)
    cylinder("desk lamp base",(w*.31,d*.20,h+.02),.075,.025,"metal")
    rod("desk lamp stem",(w*.31,d*.20,h+.03),(w*.31,d*.20,h+.37),.008,"metal")
    ellipsoid("desk lamp shade",(w*.31,d*.15,h+.37),(.19,.19,.11),"white")


def furniture_office_chair(w,d,h):
    for i in range(5):
        a=i*math.tau/5
        rod("chair five-star base",(0,0,.12),(math.cos(a)*w*.46,math.sin(a)*d*.46,.055),.012,"metal")
    cylinder("chair piston",(0,0,.30),.024,.4,"metal")
    cushion("office chair seat",(0,0,h*.46),(w*.9,d*.85,.11),"sage")
    cushion("office chair back",(0,d*.37,h*.76),(w*.86,.12,h*.48),"sage")


GENERATORS={
    "sofa":furniture_sofa,"armchair":furniture_armchair,
    "coffee_table":lambda w,d,h:furniture_table(w,d,h,True),"dining_table":lambda w,d,h:furniture_table(w,d,h,True),
    "dining_chair":furniture_chair,"chair":furniture_chair,
    "bed":furniture_bed,"bedside_table":furniture_cabinet,"cabinet":furniture_cabinet,
    "kitchen_run":furniture_kitchen,"kitchen_cabinet":furniture_kitchen,
    "fridge":furniture_fridge,"plant":furniture_plant,"rug":furniture_rug,
    "desk":furniture_desk,"office_chair":furniture_office_chair,
    "toilet":furniture_toilet,"shower":furniture_shower,"vanity":furniture_vanity,
    "pendant":furniture_pendant,"bookcase":furniture_bookcase,"tv":furniture_tv,
}


def create_architecture(scene):
    global ACTIVE_ID,ROOT
    ROOT=None
    opening_map={}
    for o in scene.get("openings",[]):opening_map.setdefault(o["host_wall_id"],[]).append(o)
    levels={v["id"]:v for v in scene["levels"]}
    for wall in scene["walls"]:
        ACTIVE_ID=wall["id"]
        if wall.get("demolition_status","existing")!="existing":
            raise ValueError(f"Structural modifications are not supported by this builder: {ACTIVE_ID}")
        points=wall["path_xy_m"]
        height=wall["height_m"];thick=wall["thickness_m"]
        elevation=levels[wall["level_id"]].get("elevation_m",0)
        cumulative=0
        for p,q in zip(points[:-1],points[1:]):
            length=math.dist(p,q)
            if length<=0:raise ValueError("Zero length wall")
            dx,dy=(q[0]-p[0])/length,(q[1]-p[1])/length
            angle=math.atan2(dy,dx)
            holes=[]
            for o in opening_map.get(ACTIVE_ID,[]):
                start=o["offset_from_start_m"]-cumulative
                end=start+o["width_m"]
                if start<-.00001 or end>length+.00001:
                    if end>0 and start<length:raise ValueError(f"Opening spans a wall corner: {o['id']}")
                    continue
                sill=o.get("sill_height_m",0)
                if sill<0 or sill+o["height_m"]>height+.00001:raise ValueError("Opening exceeds wall height")
                holes.append((start,end,sill,sill+o["height_m"],o))
            breaks=sorted({0,length,*[x for a,b,_,_,_ in holes for x in [a,b]]})
            for i,(a,b) in enumerate(zip(breaks[:-1],breaks[1:])):
                if b-a<.00001:continue
                mids=[o for o in holes if o[0]<=(a+b)*.5<=o[1]]
                if len(mids)>1:raise ValueError("Overlapping openings")
                spans=[(0,height)] if not mids else [(0,mids[0][2]),(mids[0][3],height)]
                for low,high in spans:
                    if high-low<.0001:continue
                    pos=(p[0]+dx*(a+b)*.5,p[1]+dy*(a+b)*.5,elevation+(low+high)*.5)
                    obj=box(f"wall segment {i} {low:.2f}",pos,(b-a,thick,high-low),wall.get("material_id") or "wall",.003)
                    obj.rotation_euler[2]=angle
                    obj["structural_state"]=wall.get("structural_state","unknown")
                # Short solid skirts follow only uninterrupted floor portions.
                if not mids or mids[0][2]>.01:
                    for side in [-1,1]:
                        pos=(p[0]+dx*(a+b)*.5-dy*side*(thick*.5+.009),p[1]+dy*(a+b)*.5+dx*side*(thick*.5+.009),elevation+.045)
                        ob=box("oak skirting",pos,(b-a,.014,.09),"oak",.002)
                        ob.rotation_euler[2]=angle
            for a,b,sill,top,o in holes:
                ACTIVE_ID=o["id"]
                center=(a+b)*.5
                cx=p[0]+dx*center;cy=p[1]+dy*center
                # Doorways remain open, as the photographed plan contains swing arcs.
                if o["type"]=="window":
                    for along in [a+.025,b-.025]:
                        ob=box("window jamb",(p[0]+dx*along,p[1]+dy*along,elevation+(sill+top)*.5),(.05,thick*.76,top-sill),"white",.004);ob.rotation_euler[2]=angle
                    for z in [sill+.025,top-.025]:
                        ob=box("window frame",(cx,cy,elevation+z),(b-a,thick*.76,.05),"white",.004);ob.rotation_euler[2]=angle
                    n=max(1,round((b-a)/.75))
                    for k in range(1,n):
                        along=a+(b-a)*k/n
                        ob=box("window mullion",(p[0]+dx*along,p[1]+dy*along,elevation+(sill+top)*.5),(.035,.05,top-sill-.04),"white",.002);ob.rotation_euler[2]=angle
                    ob=box("window glass",(cx,cy,elevation+(sill+top)*.5),(b-a-.06,.008,top-sill-.07),"glass",0);ob.rotation_euler[2]=angle
                    ob=box("window sill",(cx,cy,elevation+sill-.015),(b-a+.04,thick+.08,.035),"white",.008);ob.rotation_euler[2]=angle
                else:
                    threshold=box("door threshold floor",(cx,cy,elevation-.027),(b-a,thick+.02,.05),"oak",.001)
                    threshold.rotation_euler[2]=angle
                    threshold["architecture_role"]="threshold"
                    for along in [a+.015,b-.015]:
                        ob=box("door lining",(p[0]+dx*along,p[1]+dy*along,elevation+top*.5),(.03,thick+.016,top),"oak",.003);ob.rotation_euler[2]=angle
                    ob=box("door head lining",(cx,cy,elevation+top-.015),(b-a,.03+thick,.03),"oak",.003);ob.rotation_euler[2]=angle
                ACTIVE_ID=wall["id"]
            cumulative+=length
    finish_partitions=partition_room_finishes(scene["rooms"])
    for room in scene["rooms"]:
        ACTIVE_ID=room["id"]
        elev=levels[room["level_id"]].get("elevation_m",0)
        poly=room["boundary_xy_m"]
        if poly[0]==poly[-1]:poly=poly[:-1]
        floor_mat=room.get("floor_material_id","oak")
        if floor_mat not in MATS:floor_mat="oak"
        partition=finish_partitions[room["id"]]
        floor=partition_surface("floor",partition,elev-.006,floor_mat,.12)
        floor["finish_overlap_under_wall_m"]=.11
        floor["architecture_role"]="floor"
        height=levels[room["level_id"]]["ceiling_height_m"]
        ceiling=partition_surface("ceiling",partition,elev+height,"ceiling",.1,offset=1)
        ceiling["finish_overlap_under_wall_m"]=.11
        ceiling["architecture_role"]="ceiling"
        # Individual plank seams at real 180 mm pitch; clipped to room polygons.
        if "tile" not in floor_mat:
            lowx=min(p[0] for p in poly);highx=max(p[0] for p in poly)
            lowy=min(p[1] for p in poly);highy=max(p[1] for p in poly)
            y=lowy+.18
            while y<highy-.01:
                xs=[]
                for a,b in zip(poly,poly[1:]+poly[:1]):
                    if (a[1]<=y<b[1]) or (b[1]<=y<a[1]):
                        xs.append(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))
                xs.sort()
                for a,b in zip(xs[::2],xs[1::2]):
                    curve("floorboard fine joint",[(a,y,elev-.004),(b,y,elev-.004)],.00055,"oak_dark")
                y+=.18


def create_furniture(scene, assets, asset_root):
    global ACTIVE_ID,ACTIVE_CATEGORY,ROOT
    records={a["asset_id"]:a for a in assets.get("assets",assets.get("records",[]))}
    for item in scene.get("objects",[]):
        ACTIVE_ID=item["id"]
        ACTIVE_CATEGORY=item["category"]
        asset=records.get(item.get("asset_id"))
        if not asset:raise ValueError(f"asset_missing: {item.get('asset_id')} for {ACTIVE_ID}")
        generator=asset.get("generator") or asset.get("metadata",{}).get("generator")
        if isinstance(generator,dict):generator=generator.get("name")
        if generator and generator not in GENERATORS:raise ValueError(f"Unsupported registered generator {generator}; no proxy fallback")
        if not generator and not asset.get("file_uri"):raise ValueError(f"asset_missing: {asset['asset_id']}")
        ROOT=None
        parent=bpy.data.objects.new(ACTIVE_ID,None)
        bpy.context.collection.objects.link(parent)
        parent["scene_id"]=ACTIVE_ID
        parent["asset_id"]=asset["asset_id"]
        parent["source_revision"]=REVISION
        parent["asset_quality"]="development_custom_fixture" if generator else "imported_registered_asset"
        PARTS.setdefault(ACTIVE_ID,[]).append(parent.name)
        ROOT=parent
        dims=item["dimensions_m"]
        if generator:
            GENERATORS[generator](*dims)
        else:
            imported=import_registered(asset,asset_root,parent,dims,ACTIVE_ID,REVISION)
            PARTS[ACTIVE_ID].extend(o.name for o in imported)
        bind_primary_material(item,asset,generator)
        trans=item.get("transform",{})
        parent.location=trans.get("position_m",[0,0,0])
        parent.rotation_euler=trans.get("rotation_euler_rad",[0,0,0])
        parent.scale=trans.get("scale",[1,1,1])
        for name in PARTS[ACTIVE_ID]:
            ob=bpy.data.objects.get(name)
            if ob:ob["asset_id"]=asset["asset_id"]
        ROOT=None
        ACTIVE_CATEGORY=None


def configure_lighting(scene):
    global ACTIVE_ID,ROOT
    ROOT=None;ACTIVE_ID="environment_daylight"
    world=bpy.data.worlds.new("Window daylight · visual scenario, true north unknown")
    world.use_nodes=True
    nodes=world.node_tree.nodes;links=world.node_tree.links
    bg=nodes.get("Background");bg.inputs["Strength"].default_value=.35
    sky=nodes.new("ShaderNodeTexSky");sky.sky_type="NISHITA"
    sky.sun_elevation=math.radians(36);sky.sun_rotation=math.radians(135)
    sky.altitude=.1;sky.air_density=1;sky.dust_density=.6
    links.new(sky.outputs[0],bg.inputs["Color"])
    bpy.context.scene.world=world
    sun_data=bpy.data.lights.new("daylight sun","SUN");sun_data.energy=1.8;sun_data.angle=math.radians(2)
    sun=bpy.data.objects.new("sun · illustrative orientation",sun_data);bpy.context.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(34),math.radians(-25),math.radians(-135))
    sun["simulation_status"]="visual_scenario_not_site_calibrated"
    for light in scene.get("lights",[]):
        ACTIVE_ID=light["id"]
        kind=light.get("type","area").upper()
        data=bpy.data.lights.new(ACTIVE_ID,kind if kind in {"AREA","POINT","SPOT","SUN"} else "AREA")
        data.energy=light.get("power_w",light.get("energy",80))
        data.color=tuple(light.get("color_rgb",[1,.83,.63]))
        if data.type=="AREA":data.size=light.get("size_m",.35)
        ob=bpy.data.objects.new(ACTIVE_ID,data);bpy.context.collection.objects.link(ob)
        ob.location=light.get("position_m",light.get("transform",{}).get("position_m",[0,0,2.5]))
        ob.rotation_euler=light.get("rotation_euler_rad",[0,0,0])
        track(ob,"physical fixture")


def configure_cameras(scene):
    global ACTIVE_ID,ROOT
    ROOT=None
    for c in scene["cameras"]:
        ACTIVE_ID=c["id"]
        data=bpy.data.cameras.new(c["id"])
        data.type="PANO" if c["type"]=="equirectangular" else "ORTHO" if c["type"]=="orthographic" else "PERSP"
        data.lens=c.get("focal_length_mm",c.get("lens_mm",28))
        data.clip_start=.05;data.clip_end=200
        if data.type=="ORTHO":data.ortho_scale=c.get("ortho_scale_m",15)
        if data.type=="PANO":
            if hasattr(data,"panorama_type"):data.panorama_type="EQUIRECTANGULAR"
            elif hasattr(data,"cycles"):data.cycles.panorama_type="EQUIRECTANGULAR"
        obj=bpy.data.objects.new(c["id"],data);bpy.context.collection.objects.link(obj)
        obj.location=c["position_m"]
        if data.type=="PANO":
            # Camera horizon: local -Z points toward world +Y.
            obj.rotation_euler=(math.pi/2,0,c.get("rotation_euler_rad",[0,0,0])[2])
        elif c.get("look_at_m"):
            obj.rotation_euler=(Vector(c["look_at_m"])-obj.location).to_track_quat("-Z","Y").to_euler()
        else:obj.rotation_euler=c.get("rotation_euler_rad",[math.pi/2,0,0])
        obj["scene_id"]=ACTIVE_ID;obj["source_revision"]=REVISION
        obj["cutaway"]=bool(c.get("cutaway",False))
        PARTS[ACTIVE_ID]=[obj.name]
    bpy.context.scene.camera=bpy.data.objects[scene["cameras"][0]["id"]]


def main():
    global REVISION
    parser=argparse.ArgumentParser()
    parser.add_argument("--scene",required=True)
    parser.add_argument("--assets",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--asset-root")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    scene_path=Path(args.scene).resolve();assets_path=Path(args.assets).resolve();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    scene=json.loads(scene_path.read_text());assets=json.loads(assets_path.read_text())
    asset_root=Path(args.asset_root).resolve() if args.asset_root else assets_path.parent
    REVISION=scene["revision"]
    for asset in assets.get("assets", assets.get("records", [])):
        license_record = asset.get("license", {})
        if license_record.get("commercial_use_allowed") is not True:
            raise ValueError(f"asset_license_rejected: {asset.get('asset_id')}")
        if not license_record.get("license_id"):
            raise ValueError(f"asset_license_missing: {asset.get('asset_id')}")
    for asset in assets.get("assets",assets.get("records",[])):
        if not asset.get("generator"):
            verify(asset,asset_root)
    start=time.time()
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    for d in list(bpy.data.materials):bpy.data.materials.remove(d)
    target=bpy.context.scene
    target.unit_settings.system="METRIC";target.unit_settings.scale_length=1
    target.render.engine="CYCLES"
    target.cycles.samples=48;target.cycles.use_denoising=True
    target.cycles.max_bounces=8;target.cycles.diffuse_bounces=5;target.cycles.transmission_bounces=6
    target.cycles.transparent_max_bounces=8
    target.cycles.use_adaptive_sampling=True;target.cycles.adaptive_threshold=.04
    target.render.threads_mode="FIXED";target.render.threads=16
    target.view_settings.view_transform="AgX"
    target.render.image_settings.file_format="PNG";target.render.image_settings.color_mode="RGB"
    target.render.resolution_x=1920;target.render.resolution_y=1080;target.render.resolution_percentage=100
    make_materials(scene)
    create_architecture(scene)
    create_furniture(scene,assets,asset_root)
    configure_lighting(scene)
    configure_cameras(scene)
    scene_hash=digest(scene_path);asset_hash=digest(assets_path)
    builder_hash=hashlib.sha256(Path(__file__).read_bytes()+(Path(__file__).parent/"import_assets.py").read_bytes()).hexdigest()
    build_id="build_"+hashlib.sha256((scene_hash+asset_hash+VERSION+builder_hash).encode()).hexdigest()[:16]
    target["scene_revision"]=REVISION;target["scene_hash"]=scene_hash;target["project_id"]=scene["project_id"]
    target["asset_manifest_hash"]=asset_hash;target["build_id"]=build_id;target["builder_version"]=VERSION
    target["source_scene_json"]=json.dumps(scene,ensure_ascii=False)
    has_fixture=any(a.get("generator") for a in assets.get("assets",[]))
    production_approved=not has_fixture and all(a.get("approved") and a.get("approval_evidence") for a in assets.get("assets",[]))
    target["asset_quality"]= "development_custom_fixture_not_approved_production" if has_fixture else "registered_production" if production_approved else "registered_unapproved"
    target["production_approved"]=production_approved
    target["geometry_calibrated"]=all(w.get("source",{}).get("kind") in {"measured","user_confirmed","cad"} for w in scene["walls"])
    target["builder_sha256"]=builder_hash
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"project.blend"))
    if scene_path != (out/"scene_resolved.json").resolve():
        shutil.copyfile(scene_path,out/"scene_resolved.json")
    if assets_path != (out/"asset_manifest.json").resolve():
        shutil.copyfile(assets_path,out/"asset_manifest.json")
    inspection={"scene_revision":REVISION,"build_id":build_id,"scene_hash":scene_hash,"object_mapping":PARTS,"material_bindings":{o.name:o.get("scene_material_id") for o in bpy.data.objects if o.get("scene_material_id")},"object_count":len(bpy.data.objects),"mesh_count":len(bpy.data.meshes),"materials":list(MATS),"missing_textures":[],"asset_quality":"development_custom_fixture","warnings":["Hero assets are detailed local development fixtures, awaiting professional asset approval.","Dimensions derived from home1.png are uncalibrated; preview only."]}
    save_json(out/"inspection.json",inspection)
    manifest={"project_id":scene["project_id"],"scene_revision":REVISION,"build_id":build_id,"scene_hash":scene_hash,"asset_manifest_hash":asset_hash,"builder_version":VERSION,"builder_sha256":builder_hash,"builder_script_sha256":digest(Path(__file__)),"asset_importer_sha256":digest(Path(__file__).parent/"import_assets.py"),"input_scene_path":str(scene_path),"blender_version":bpy.app.version_string,"project_blend":"project.blend","project_blend_sha256":digest(out/"project.blend"),"created_at_unix":time.time(),"build_duration_s":round(time.time()-start,2),"quality_status":"preview_only","artifacts":["project.blend","inspection.json","scene_resolved.json","asset_manifest.json"]}
    # Export the same meshes for a transparent, inspectable browser model.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH","CURVE","EMPTY"} and obj.get("architecture_role")!="ceiling":
            obj.select_set(True)
    try:
        bpy.ops.export_scene.gltf(filepath=str(out/"scene.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True)
        manifest["artifacts"].append("scene.glb");manifest["scene_glb_sha256"]=digest(out/"scene.glb")
    except Exception as exc:
        manifest["glb_export_warning"]=str(exc)
    save_json(out/"build_manifest.json",manifest)
    print(json.dumps({"status":"success","build_id":build_id,"output":str(out),"elapsed_s":round(time.time()-start,1)}))


if __name__=="__main__":main()
