"""Blender 4.5: fixed cameras for one exported latest Three scene; no wall removal.
Run: blender --background --factory-startup --python scripts/sunlit-spatial-render.py -- --rooms dining kitchen living
"""
from pathlib import Path
import argparse,json,math,time,hashlib,sys,subprocess
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def material(name,color,roughness=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness;return m

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',default=str(ROOT/'public/concepts/spatial/sunlit/references'));p.add_argument('--rooms',nargs='+',default=['living','dining','kitchen','master','study','guest','bathroom','living-detail','dining-detail']);p.add_argument('--plans',action='store_true');p.add_argument('--samples',type=int,default=16);p.add_argument('--threads',type=int,default=12);p.add_argument('--width',type=int,default=1536);p.add_argument('--height',type=int,default=1024);p.add_argument('--rebuild',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
 out=Path(a.source).resolve();source=out/'scene.json';data=json.loads(source.read_text());glb=out/'scene.glb';
 manifest=json.loads((out/'manifest.json').read_text());
 if manifest['scene']['sha256']!=digest(source) or manifest['model']['sha256']!=digest(glb):raise ValueError('Source or model hash does not match frozen export manifest')
 subprocess.run(['python3',str(ROOT/'scripts/check-sunlit-spatial.py'),'--scene',str(source)],cwd=ROOT,check=True)
 archive=ROOT/'output/imagegen/sunlit-spatial-20261102';archive.mkdir(parents=True,exist_ok=True);blend=archive/'locked-scene.blend';scene_hash=data['structureHash']
 if blend.is_file() and not a.rebuild:
  bpy.ops.wm.open_mainfile(filepath=str(blend),load_ui=False,use_scripts=False)
  if bpy.context.scene.get('structureHash')!=scene_hash:raise ValueError('Existing Blender file belongs to different structure; use --rebuild')
 else:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(glb))
  scene=bpy.context.scene;scene['structureHash']=scene_hash;scene['glb_sha256']=digest(glb);scene['source_sha256']=digest(source);scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
  for ob in list(scene.objects):
   if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
  world=bpy.data.worlds.new('Neutral reference daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.82,.85,1);world.node_tree.nodes['Background'].inputs[1].default_value=.75;scene.world=world
  def light(name,kind,pos,power,size=4):
   d=bpy.data.lights.new(name,kind);d.energy=power;d.color=(1,.95,.86)
   if kind=='AREA':d.shape='DISK';d.size=size
   o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;return o
  sun=light('Reference soft sun','SUN',(-3,8,14),2);sun.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-30));sun.data.angle=math.radians(7)
  for room in data['rooms']:
   poly=room['polygon'];xs=[v[0] for v in poly];zs=[v[1] for v in poly];x=(min(xs)+max(xs))/2;z=(min(zs)+max(zs))/2
   light('Neutral fill '+room['id'],'AREA',(x,-z,2.57),60 if room['id'] not in ['bathroom','entry','balcony'] else 35,2)
  # Matte exterior ground does not change the building.
  bpy.ops.mesh.primitive_plane_add(size=200,location=(6,-4,-.235));ground=bpy.context.object;ground.name='Exterior neutral ground';ground.data.materials.append(material('ground',(.78,.79,.75)))
  for c in data['cameras']:
   cd=bpy.data.cameras.new(c['id']);cd.lens=c['lensMm'];cd.sensor_width=36;cd.sensor_fit='HORIZONTAL';cd.clip_start=.03;cd.clip_end=100
   ob=bpy.data.objects.new('camera-'+c['id'],cd);scene.collection.objects.link(ob);x,h,z=c['position'];ob.location=(x,-z,h);tx,th,tz=c['target'];ob.rotation_euler=(Vector((tx,-tz,th))-ob.location).to_track_quat('-Z','Y').to_euler();ob['viewId']=c['id'];ob['roomId']=c['roomId'];ob['noWallRemoval']=True
  bpy.ops.wm.save_as_mainfile(filepath=str(blend))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=a.threads;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.6
 # Only ceiling group is hidden for explicitly labelled plan drawings.
 ceilings=bpy.data.objects.get('ceilings');ceiling_objects=list(ceilings.children_recursive) if ceilings else []
 def render(name,camera,width,height,plan=False,extra=None):
  image=out/(name+'.png');mfile=out/(name+'.render.json')
  if image.is_file() and mfile.is_file():
   old=json.loads(mfile.read_text());
   if old.get('structureHash')==scene_hash and old.get('sceneGlbSha256')==digest(glb) and old.get('sha256')==digest(image) and (not extra or not extra.get('sourceCamera') or old.get('sourceCamera')==extra['sourceCamera']):print('VERIFIED '+name,flush=True);return
  for ob in ceiling_objects:ob.hide_render=plan
  scene.camera=camera;scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100;scene.render.filepath=str(image);t=time.time();bpy.ops.render.render(write_still=True)
  manifest={'id':name,'structureHash':scene_hash,'sceneGlbSha256':digest(glb),'camera':camera.name,'cameraPositionBlender':list(camera.location),'lensMm':camera.data.lens,'projection':camera.data.type,'resolution':[width,height],'samples':a.samples,'threads':a.threads,'blenderVersion':bpy.app.version_string,'renderEngine':'CYCLES','wallsHidden':False,'ceilingHidden':plan,'durationSeconds':round(time.time()-t,2),'sha256':digest(image),'source':'deterministic Blender render of exported latest Three scene','renderScriptSha256':digest(Path(__file__).resolve()),**(extra or {})};mfile.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(archive/image.name).write_bytes(image.read_bytes());(archive/mfile.name).write_bytes(mfile.read_bytes());print('COMPLETE '+name,flush=True)
 for rid in a.rooms:
  c=next((c for c in data['cameras'] if c['id']==rid),None)
  if not c:raise ValueError('Unknown room view '+rid)
  render(rid,bpy.data.objects['camera-'+rid],a.width,a.height,extra={'sourceCamera':c})
 if a.plans:
  def top(name,poly,room=None):
   xs=[v[0] for v in poly];zs=[v[1] for v in poly];left,right=min(xs)-.25,max(xs)+.25;top,bottom=min(zs)-.25,max(zs)+.25
   width,height=1536,1280;ratio=width/height;span=max(right-left,(bottom-top)*ratio);x=(left+right)/2;z=(top+bottom)/2
   cd=bpy.data.cameras.new('top-'+name);cd.type='ORTHO';cd.ortho_scale=span;cd.clip_start=.01;cd.clip_end=100;cd.sensor_fit='HORIZONTAL';ob=bpy.data.objects.new('top-'+name,cd);scene.collection.objects.link(ob);ob.location=(x,-z,25);ob.rotation_euler=(0,0,0)
   visible_w=span;visible_h=span/ratio;extent={'left':x-visible_w/2,'right':x+visible_w/2,'top':z-visible_h/2,'bottom':z+visible_h/2}
   render(name,ob,width,height,plan=True,extra={'roomId':room,'drawingExtent':extent,'drawingTop':'original plan top; geography not inferred','cameraMarkers':[{'id':c['id'],'x':c['position'][0],'z':c['position'][2],'targetX':c['target'][0],'targetZ':c['target'][2]} for c in data['cameras'] if room is None or c['roomId']==room]})
  top('plan',data['outline'])
  for rid in ['living','dining','kitchen','master','study','guest','bathroom']:
   room=next(r for r in data['rooms'] if r['id']==rid);poly=room['polygon']
   if rid=='dining':poly=poly+next(r for r in data['rooms'] if r['id']=='balcony')['polygon']
   top(rid+'-plan',poly,rid)
 print('ALL REQUESTED REFERENCES COMPLETE',flush=True)
if __name__=='__main__':main()
