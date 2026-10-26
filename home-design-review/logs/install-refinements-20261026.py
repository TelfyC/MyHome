"""Package built-in imagegen outputs as the site's 28 panoramas and thumbnails."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

root = Path(__file__).resolve().parents[2]
styles = ['forest', 'japanese', 'french', 'sunlit']
rooms = ['living', 'dining', 'master', 'study', 'guest', 'kitchen', 'bathroom']
records = []
# Verify every input before changing any live asset.
jobs = []
for style in styles:
    for room in rooms:
        meta_path = root / 'home-design-review/logs/refinement-assets' / f'{style}-{room}.json'
        meta = json.loads(meta_path.read_text())
        source = Path(meta['path'])
        with Image.open(source) as im:
            assert im.width == im.height * 2, f'{style}/{room}: panorama is not 2:1'
            assert im.width >= 1600, f'{style}/{room}: unexpectedly low resolution'
        jobs.append((style, room, source))
for style, room, source in jobs:
    target = root / 'public/panoramas' / style
    with Image.open(source) as im:
        im = im.convert('RGB')
        full = target / f'{room}.jpg'
        im.save(full, quality=93, subsampling=0, optimize=True, progressive=True)
        thumb = target / f'{room}-thumb.jpg'
        im.resize((320, 160), getattr(Image, 'Resampling', Image).LANCZOS).save(thumb, quality=88, optimize=True)
        for file, dimensions in [(full, [im.width, im.height]), (thumb, [320, 160])]:
            records.append({'path': str(file.relative_to(root)), 'dimensions': dimensions,
                            'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
# User removed this style. Keep a local historical backup outside the deployed public tree.
retired = root / 'home-design-review/input/retired-cream-20261026'
retired.mkdir(exist_ok=True)
for file in (root / 'public/panoramas').glob('*.jpg'):
    destination = retired / file.name
    if destination.exists():
        assert destination.read_bytes() == file.read_bytes(), f'Different retired backup: {file}'
        file.unlink()
    else:
        shutil.move(file, destination)
manifest = {'date': '2026-10-26', 'tool': 'built-in image_gen', 'styles': styles,
            'rooms': rooms, 'retiredStyle': 'cream', 'assets': records}
(root / 'home-design-review/input/detail-refinement-manifest-20261026.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Installed {len(jobs)} panoramas and {len(jobs)} thumbnails; retired style is outside public/.')
