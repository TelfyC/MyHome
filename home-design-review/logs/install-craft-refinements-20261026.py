"""Package the reviewed rectilinear room images without resizing/upscaling originals."""
from pathlib import Path
from PIL import Image
import json
import hashlib

root=Path(__file__).resolve().parents[2]
logs=root/'home-design-review/logs/craft-refinement-20261026'
styles=['forest','japanese','french','sunlit']
rooms=['living','dining','master','study','guest','kitchen','bathroom']
jobs=[]
for style in styles:
 for room in rooms:
  meta_file=logs/f'{style}-{room}-styling.json'
  if not meta_file.exists():meta_file=logs/f'{style}-{room}.json'
  meta=json.loads(meta_file.read_text());source=Path(meta['path'])
  with Image.open(source) as im:
   assert im.width>=1500 and im.height>=1000,f'Low resolution: {style}/{room}'
   assert abs(im.width/im.height-1.5)<.03,f'Not a rectilinear 3:2 view: {style}/{room}'
  jobs.append((style,room,source,meta_file))
assets=[]
for style,room,source,meta_file in jobs:
 target=root/'public/room-views'/style;target.mkdir(parents=True,exist_ok=True)
 with Image.open(source) as im:
  im=im.convert('RGB');full=target/f'{room}.jpg';im.save(full,quality=95,subsampling=0,optimize=True,progressive=True)
  thumb=target/f'{room}-thumb.jpg';preview=im.copy();preview.thumbnail((320,214),getattr(Image,'Resampling',Image).LANCZOS);preview.save(thumb,quality=90,optimize=True)
  for file,size in [(full,im.size),(thumb,preview.size)]:
   assets.append({'path':str(file.relative_to(root)),'size':list(size),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'record':str(meta_file.relative_to(root))})
manifest={'date':'2026-10-26','version':'craft-v2','projection':'rectilinear','panoramas':'Existing 360 assets retained as spatial reference; not claimed to be higher resolution.','generatedBy':'built-in image_gen','assets':assets}
(root/'home-design-review/input/craft-refinement-manifest-20261026.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Installed {len(jobs)} native-size room views and {len(jobs)} thumbnails.')
