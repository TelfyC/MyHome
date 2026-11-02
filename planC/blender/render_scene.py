"""Render only existing .blend scene cameras through fixed Cycles profiles."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
import bpy

PROFILES={
    "preview_fast":(960,540,24),
    "review":(1920,1080,48),
    "final_still_4k":(3840,2160,128),
    "draft_still_4k":(3840,2160,32),
    "panorama_8k_preview":(8192,4096,16),
    "panorama_preview":(2048,1024,32),
    "panorama_8k_final":(8192,4096,192),
}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--blend",required=True)
    p.add_argument("--camera",required=True)
    p.add_argument("--profile",choices=PROFILES,required=True)
    p.add_argument("--output",required=True)
    args=p.parse_args(sys.argv[sys.argv.index("--")+1:])
    blend=Path(args.blend).resolve();out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
    if Path(bpy.data.filepath).resolve()!=blend:bpy.ops.wm.open_mainfile(filepath=str(blend),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    camera=bpy.data.objects.get(args.camera)
    if not camera or camera.type!="CAMERA":raise ValueError("Unknown Scene camera")
    panorama=args.profile.startswith("panorama")
    if panorama!=(camera.data.type=="PANO"):raise ValueError("Profile/camera projection mismatch")
    scene.camera=camera
    width,height,samples=PROFILES[args.profile]
    scene.render.engine="CYCLES";scene.cycles.samples=samples;scene.cycles.use_denoising=True
    scene.cycles.device="CPU"
    scene.render.threads_mode="FIXED";scene.render.threads=16
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGB"
    scene.render.filepath=str(out)
    if camera.get("cutaway",False):
        for obj in scene.objects:
            if obj.get("architecture_role")=="ceiling":obj.hide_render=True
    # Exact final dimensions are a profile contract, never an upscaled preview.
    if "final" in args.profile and not scene.get("production_approved",False):
        raise ValueError("asset_missing: reviewed production Hero assets required for final profiles")
    if "final" in args.profile and not scene.get("geometry_calibrated",False):
        raise ValueError("needs_confirmation: calibrated geometry required for final profiles")
    started=time.time()
    bpy.ops.render.render(write_still=True)
    if not out.is_file():raise RuntimeError("Renderer returned without output")
    image=bpy.data.images.load(str(out),check_existing=False)
    actual=list(image.size)
    bpy.data.images.remove(image)
    if actual!=[width,height]:raise RuntimeError("Render resolution mismatch")
    payload={"project_id":scene.get("project_id"),"scene_revision":scene.get("scene_revision"),"scene_hash":scene.get("scene_hash"),"build_id":scene.get("build_id"),"render_job_id":"render_"+hashlib.sha256((scene.get("build_id","")+args.camera+args.profile).encode()).hexdigest()[:16],"camera_id":args.camera,"render_profile_id":args.profile,"projection":"equirectangular" if panorama else "perspective","resolution_px":actual,"samples":samples,"render_engine":"CYCLES","device":"CPU","blender_version":bpy.app.version_string,"image_uri":out.name,"file_sha256":hashlib.sha256(out.read_bytes()).hexdigest(),"duration_s":round(time.time()-started,2),"quality_status":"preview_only" if "final" not in args.profile else "final","created_at_unix":time.time(),"render_script_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"project_blend_sha256":hashlib.sha256(blend.read_bytes()).hexdigest()}
    out.with_suffix(".manifest.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"status":"success",**payload}))


if __name__=="__main__":main()
