"""Deterministic, explicitly inferred home1 drawing transcription (metres).

No measurement is promoted to user_confirmed. This generates a design review
scene, never a construction survey or an approved structural alteration.
"""
from pathlib import Path
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'planC/data/sunlit'
SOURCE = 'docs/方案B/home1.png'
EVIDENCE = {'kind': 'image_inferred', 'reference': SOURCE, 'confidence': 0.65}
DESIGN = {'kind': 'designer_proposed', 'reference': '日光花园 · Plan C 首版', 'confidence': None}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    scene = {
        'schema_version': '1.0.0', 'project_id': 'home1_sunlit', 'revision': 1,
        'title': '日光花园 · 真实三维首版', 'units': 'm',
        'coordinate_system': {'handedness': 'right', 'up': '+Z', 'north': '+Y', 'angles': 'radians',
                              'note': '+Y 对应图纸上方；地理北向未确认'},
        'site': {'latitude': None, 'longitude': None, 'timezone': 'Asia/Shanghai',
                 'true_north_offset_rad': None},
        'source_plan': {'path': SOURCE, 'sha256': hashlib.sha256((ROOT / SOURCE).read_bytes()).hexdigest(),
                        'calibration': 'independent annotated dimension chains; schematic drawing is not uniformly scaled',
                        'status': 'needs_confirmation'},
        'levels': [{'id': 'level_1', 'elevation_m': 0, 'ceiling_height_m': 2.7, 'source': DESIGN}],
        'walls': [], 'openings': [], 'rooms': [], 'objects': [],
        'materials': [
            {'id': 'mat_oak', 'type': 'pbr', 'base_color': '#bb9b72', 'roughness': 0.56, 'texture_repeat_m': [1.2, 0.15]},
            {'id': 'mat_ivory', 'type': 'pbr', 'base_color': '#eee9db', 'roughness': 0.78},
            {'id': 'mat_sage', 'type': 'pbr', 'base_color': '#a6ae8b', 'roughness': 0.84},
            {'id': 'mat_linen', 'type': 'pbr', 'base_color': '#dbd2bb', 'roughness': 0.9},
            {'id': 'mat_tile', 'type': 'pbr', 'base_color': '#c5bfad', 'roughness': 0.42},
            {'id': 'mat_ceramic', 'type': 'pbr', 'base_color': '#b6a28b', 'roughness': 0.40},
            {'id': 'mat_charcoal', 'type': 'pbr', 'base_color': '#343c36', 'roughness': 0.30, 'metallic': 0.60},
        ],
        'lights': [], 'cameras': [],
        'constraints': [{'id': 'preserve_source_walls', 'type': 'structural_integrity', 'severity': 'blocker'},
                        {'id': 'no_unregistered_assets', 'type': 'asset_license', 'severity': 'blocker'}],
        'metadata': {'purpose': 'design_preview', 'style': 'sunlit_garden', 'white_walls': 'preserved',
                     'lighting': 'visual daylight scenario; location, date and true north unconfirmed',
                     'height_status': 'designer_proposed', 'render_delivery': 'preview_only'},
    }

    def wall(name, a, b, white=False):
        scene['walls'].append({'id': 'wall_' + name, 'level_id': 'level_1',
                               'path_xy_m': [a, b], 'thickness_m': 0.12 if white else 0.20,
                               'height_m': 2.7, 'structural_state': 'unknown',
                               'demolition_status': 'existing', 'source': EVIDENCE,
                               'material_id': 'mat_ivory', 'drawing_class': 'white_partition' if white else 'black_wall'})

    # Independent dimension chains respect the drawing's approximate widths;
    # the image explicitly says it is NOT a uniform-scale construction drawing.
    for args in [
        ('master_west', [-.10, 0], [-.10, 6.25]),
        ('master_south', [-.10, 0], [3.35, 0]),
        ('master_east', [3.35, 0], [3.35, 4.70]),
        ('bath_north', [-.10, 6.35], [1.55, 6.35]),
        ('bath_east', [3.35, 4.90], [3.35, 6.35], True),
        ('guest_west', [1.55, 6.35], [1.55, 10.50]),
        ('guest_north', [1.55, 10.50], [4.95, 10.50]),
        ('guest_east', [4.95, 6.35], [4.95, 10.50], True),
        ('guest_south', [1.55, 6.35], [4.95, 6.35], True),
        ('corridor_north', [4.95, 10.50], [7.10, 10.50]),
        ('dining_west', [7.10, 6.35], [7.10, 10.50]),
        ('balcony_west', [7.10, 10.50], [7.10, 11.30], True),
        ('balcony_north', [7.10, 11.30], [9.80, 11.30], True),
        ('dining_east', [9.80, 7.30], [9.80, 11.30], True),
        ('kitchen_north', [9.80, 10.50], [12.15, 10.50]),
        ('kitchen_east', [12.15, 7.30], [12.15, 10.50]),
        ('kitchen_south', [9.80, 7.30], [12.15, 7.30], True),
        ('entry_east', [11.30, 4.30], [11.30, 7.30]),
        ('entry_south', [9.80, 4.30], [11.30, 4.30]),
        ('living_east', [9.80, 1.70], [9.80, 4.30], True),
        ('living_step', [8.30, 1.70], [9.80, 1.70]),
        ('living_lower_east', [8.30, 0], [8.30, 1.70]),
        ('living_south', [6.30, 0], [8.30, 0], True),
        ('study_east', [6.30, 0.65], [6.30, 4.75]),
        ('study_north', [3.35, 4.75], [6.30, 4.75]),
        ('study_south', [3.35, 0.65], [6.30, 0.65]),
        ('study_balcony_south', [3.35, 0], [6.30, 0], True),
        ('study_balcony_east', [6.30, 0], [6.30, 0.65], True),
    ]:
        wall(*args)

    def opening(name, host, offset, width, height, sill=0, typ='door', confidence=.65):
        scene['openings'].append({'id': 'opening_' + name, 'type': typ,
                                  'host_wall_id': 'wall_' + host, 'offset_from_start_m': offset,
                                  'width_m': width, 'height_m': height, 'sill_height_m': sill,
                                  'source': {**EVIDENCE, 'confidence': confidence}})

    opening('master_south_window', 'master_south', .68, 1.50, 1.40, .85, 'window')
    opening('master_west_window', 'master_west', 2.05, 1.80, 1.45, .85, 'window')
    opening('bath_window', 'master_west', 4.95, .90, .75, 1.40, 'window')
    opening('master_door', 'master_east', 3.70, .90, 2.10)
    opening('bath_door', 'bath_east', .30, .85, 2.10)
    opening('guest_north_window', 'guest_north', .90, 1.20, 1.40, .85, 'window')
    opening('guest_west_window', 'guest_west', .80, 1.50, 1.40, .85, 'window')
    opening('guest_door', 'guest_south', 2.20, .90, 2.10)
    opening('corridor_window', 'corridor_north', .40, .90, 1.40, .85, 'window')
    opening('dining_to_corridor', 'dining_west', 1.20, .85, 2.10, 0, 'passage')
    opening('balcony_glazing', 'balcony_north', .15, 2.40, 2.40, .10, 'window')
    opening('kitchen_window', 'kitchen_north', .50, 1.20, 1.30, 1.10, 'window')
    opening('kitchen_door', 'dining_east', .90, 1.20, 2.10)
    opening('entry_door', 'entry_east', 1.55, .95, 2.10)
    opening('study_door', 'study_north', 1.65, .90, 2.10)
    opening('study_balcony_door', 'study_south', 1.50, 1.10, 2.25, 0, 'window', .45)
    opening('study_balcony_glazing', 'study_balcony_south', .15, 2.60, 2.40, .10, 'window', .45)
    opening('living_glazing', 'living_south', .15, 1.70, 2.40, .10, 'window', .45)

    def room(rid, name, points, floor='mat_oak'):
        scene['rooms'].append({'id': rid, 'name': name, 'level_id': 'level_1',
                               'boundary_xy_m': points, 'floor_material_id': floor, 'source': EVIDENCE})

    room('master', '主卧', [[0, .10], [3.25, .10], [3.25, 4.80], [0, 4.80]])
    room('bathroom', '原图卫浴区', [[0, 4.80], [3.25, 4.80], [3.25, 6.25], [0, 6.25]], 'mat_tile')
    room('guest', '次卧 / 书房', [[1.65, 6.45], [4.85, 6.45], [4.85, 10.40], [1.65, 10.40]])
    room('study', '多功能卧室', [[3.45, .75], [6.20, .75], [6.20, 4.65], [3.45, 4.65]])
    room('study_balcony', '卧室阳台', [[3.45, .10], [6.20, .10], [6.20, .55], [3.45, .55]], 'mat_tile')
    room('living', '起居室', [[6.40, .10], [8.20, .10], [8.20, 1.80], [9.70, 1.80],
                            [9.70, 4.40], [11.20, 4.40], [11.20, 5.50], [9.70, 5.50],
                            [9.70, 6.25], [6.40, 6.25]])
    room('dining', '餐厅与阳台', [[7.20, 6.25], [9.70, 6.25], [9.70, 11.20], [7.20, 11.20]])
    room('kitchen', '厨房', [[9.90, 7.40], [12.05, 7.40], [12.05, 10.40], [9.90, 10.40]], 'mat_tile')
    room('hall', '公共过道', [[3.45, 4.85], [6.20, 4.85], [6.40, 4.85], [6.40, 6.25],
                            [7.0, 6.25], [7.0, 10.40], [5.05, 10.40], [5.05, 6.25], [3.45, 6.25]])
    room('entry', '玄关', [[9.90, 5.50], [11.20, 5.50], [11.20, 7.20], [9.90, 7.20]], 'mat_tile')

    def obj(oid, cat, rid, position, dims, rot=0, mat='mat_oak', **extra):
        if cat == 'plant':
            mat = 'mat_ceramic'
        elif cat == 'tv':
            mat = 'mat_charcoal'
        elif cat == 'shower':
            mat = 'mat_tile'
        scene['objects'].append({'id': oid, 'category': cat, 'room_id': rid,
                                 'asset_id': 'custom_' + cat, 'quality_tier': 'hero' if cat in ('sofa', 'armchair', 'bed', 'dining_chair', 'plant') else 'procedural',
                                 'transform': {'position_m': position, 'rotation_euler_rad': [0, 0, rot], 'scale': [1, 1, 1]},
                                 'dimensions_m': dims, 'material_id': mat, 'source': DESIGN, **extra})

    obj('living_rug', 'rug', 'living', [8.03, 3.55, 0], [2.80, 2.60, .018], mat='mat_linen',
        contact_exceptions=['living_sofa', 'living_tv_console', 'living_books', 'living_side_table', 'living_table'])
    obj('living_sofa', 'sofa', 'living', [6.99, 3.60, 0], [2.20, .88, .84], math.pi / 2, 'mat_linen')
    obj('living_table', 'coffee_table', 'living', [8.10, 3.50, .02], [.80, .58, .38], mat='mat_ivory')
    obj('living_tv_console', 'cabinet', 'living', [9.43, 3.18, 0], [1.65, .36, .45], -math.pi / 2)
    obj('living_tv', 'tv', 'living', [9.43, 3.18, .45], [1.45, .16, .84], -math.pi / 2,
        support_object_id='living_tv_console')
    obj('living_armchair', 'armchair', 'living', [7.05, 1.32, 0], [.76, .78, .80], 2.65, 'mat_sage')
    obj('living_ficus', 'plant', 'living', [7.82, .64, 0], [.50, .50, 1.68])
    obj('living_books', 'bookcase', 'living', [6.69, 5.40, 0], [1.20, .32, 1.55], math.pi / 2)
    obj('living_pendant', 'pendant', 'living', [8.03, 3.55, 2.20], [.60, .60, .30], mat='mat_ivory', ceiling_mounted=True)
    obj('living_side_table', 'bedside_table', 'living', [7.10, 5.02, 0], [.40, .40, .48])

    obj('dining_table', 'dining_table', 'dining', [8.48, 8.12, 0], [1.35, .76, .74], math.pi / 2, 'mat_ivory')
    for i, (x, y, a) in enumerate([(7.79, 7.82, -math.pi / 2), (7.79, 8.43, -math.pi / 2),
                                   (9.16, 7.82, math.pi / 2), (9.16, 8.43, math.pi / 2)]):
        obj('dining_chair_' + str(i), 'dining_chair', 'dining', [x, y, 0], [.42, .44, .78], a, 'mat_sage')
    obj('coffee_cabinet', 'cabinet', 'dining', [8.45, 10.75, 0], [1.65, .45, .86], mat='mat_ivory')
    obj('dining_tree', 'plant', 'dining', [9.35, 9.97, 0], [.45, .45, 1.70])
    obj('dining_pendant', 'pendant', 'dining', [8.48, 8.12, 1.95], [.60, .60, .34], mat='mat_ivory', ceiling_mounted=True)

    obj('master_bed', 'bed', 'master', [1.58, 2.94, 0], [1.80, 2.12, 1.05], mat='mat_linen')
    obj('master_side_left', 'bedside_table', 'master', [.40, 3.56, 0], [.44, .44, .46])
    obj('master_side_right', 'bedside_table', 'master', [2.75, 3.56, 0], [.44, .44, .46])
    obj('master_wardrobe', 'cabinet', 'master', [1.65, 4.43, 0], [2.35, .55, 2.45], mat='mat_ivory')
    obj('master_plant', 'plant', 'master', [.45, .55, 0], [.42, .42, 1.45])

    obj('guest_bed', 'bed', 'guest', [2.45, 8.20, 0], [1.20, 2.10, .94], mat='mat_linen')
    obj('guest_desk', 'desk', 'guest', [4.35, 8.55, 0], [1.75, .60, .74], math.pi / 2)
    obj('guest_chair', 'office_chair', 'guest', [3.65, 8.55, 0], [.50, .50, .82], -math.pi / 2, 'mat_sage')
    obj('guest_bookcase', 'bookcase', 'guest', [2.40, 9.95, 0], [1.25, .32, 1.80])
    obj('guest_plant', 'plant', 'guest', [4.45, 10.0, 0], [.40, .40, 1.15])

    obj('study_bed', 'bed', 'study', [5.40, 2.05, 0], [1.20, 2.10, .94], mat='mat_linen')
    obj('study_desk', 'desk', 'study', [3.90, 2.75, 0], [1.65, .60, .74], -math.pi / 2)
    obj('study_chair', 'office_chair', 'study', [4.51, 2.75, 0], [.45, .45, .82], math.pi / 2, 'mat_sage')
    obj('study_cabinet', 'cabinet', 'study', [4.1, 4.30, 0], [1.0, .45, 1.50], mat='mat_ivory')

    obj('kitchen_north_run', 'kitchen_run', 'kitchen', [10.94, 10.02, 0], [1.90, .60, 2.40])
    obj('kitchen_east_run', 'kitchen_run', 'kitchen', [11.70, 8.58, 0], [2.15, .58, 2.40], -math.pi / 2)
    obj('kitchen_fridge', 'fridge', 'kitchen', [10.29, 7.80, 0], [.64, .65, 1.90], mat='mat_ivory')
    obj('bath_vanity', 'vanity', 'bathroom', [1.73, 5.85, 0], [1.10, .50, .86], mat='mat_ivory')
    obj('bath_toilet', 'toilet', 'bathroom', [2.52, 5.89, 0], [.42, .62, .78], mat='mat_ivory')
    obj('bath_shower', 'shower', 'bathroom', [.60, 5.32, 0], [.88, .88, 2.20])
    obj('entry_cabinet', 'cabinet', 'entry', [10.90, 6.15, 0], [1.0, .45, 2.40], math.pi / 2, 'mat_ivory')

    camera_points = [
        ('living', [8.65, 5.65, 1.55], [7.63, 2.80, 1.05], [8.12, 4.48, 1.55]),
        ('dining', [7.55, 6.85, 1.55], [8.55, 9.40, 1.12], [8.45, 9.45, 1.55]),
        ('master', [2.80, 1.0, 1.55], [1.40, 3.3, 1.0], [2.64, 1.62, 1.55]),
        ('guest', [4.40, 6.95, 1.55], [2.70, 8.90, 1.0], [3.43, 7.10, 1.55]),
        ('study', [5.85, 4.22, 1.55], [4.65, 2.0, .9], [5.0, 3.7, 1.55]),
        ('kitchen', [10.30, 8.65, 1.55], [11.50, 9.80, 1.0], [10.88, 8.95, 1.55]),
        ('bathroom', [3.0, 5.03, 1.55], [1.1, 5.77, 1.05], [2.08, 5.10, 1.55]),
    ]
    for rid, pos, target, pano in camera_points:
        scene['cameras'].append({'id': 'camera_' + rid + '_still', 'room_id': rid, 'type': 'perspective',
                                 'position_m': pos, 'look_at_m': target, 'rotation_euler_rad': [0, 0, 0],
                                 'focal_length_mm': 22, 'resolution_px': [3840, 2160]})
        scene['cameras'].append({'id': 'camera_' + rid + '_360', 'room_id': rid, 'type': 'equirectangular',
                                 'position_m': pano, 'look_at_m': target, 'rotation_euler_rad': [math.pi / 2, 0, 0],
                                 'resolution_px': [8192, 4096]})

    # These emitters coincide with modelled pendant shades, and point down.
    for rid, xyz in [('living', [8.03, 3.55, 2.235]), ('dining', [8.48, 8.12, 1.99])]:
        scene['lights'].append({'id': 'light_' + rid + '_pendant', 'type': 'area',
                                'position_m': xyz, 'rotation_euler_rad': [0, 0, 0],
                                'power_w': 24, 'size_m': .35, 'color_rgb': [1.0, .84, .65],
                                'source': DESIGN, 'fixture_object_id': rid + '_pendant'})

    categories = sorted({o['category'] for o in scene['objects']})
    assets = {'schema_version': '1.0.0', 'project_id': scene['project_id'], 'assets': [
        {'asset_id': 'custom_' + cat, 'name': 'Plan C custom development ' + cat, 'category': cat,
         'generator': cat, 'quality_tier': 'custom_fixture', 'approval_status': 'development_fixture',
         'license': {'license_id': 'project_custom_fixture', 'commercial_use_allowed': True,
                     'attribution_required': False, 'source_url': None,
                     'note': 'Project-authored parametric mesh; no external model or texture. Not reviewed as a production hero asset.'}}
        for cat in categories]}
    uncertainties = [
        {'id': 'dimensions', 'status': 'needs_confirmation', 'description': '图纸自述为估算示意；尺寸链分别转录，不能按整张图片统一标定。'},
        {'id': 'ceiling', 'status': 'needs_confirmation', 'description': '层高暂按 2.70 m 设计假设，非实测。'},
        {'id': 'structure', 'status': 'needs_confirmation', 'description': '黑白墙均保留；颜色不等同承重性质，全部标记 unknown。'},
        {'id': 'lower_glazing', 'status': 'needs_confirmation', 'description': '起居室及下侧卧室阳台边界的玻璃与洞口形式由图线推断，需现场确认。'},
        {'id': 'bathroom', 'status': 'needs_confirmation', 'description': '原图卫浴位于主卧上侧，南侧隔断不清晰；本版未新增建筑隔墙，隐私及排水待确认。'},
        {'id': 'north', 'status': 'needs_confirmation', 'description': '图纸上方定义 +Y；未确认地理北向、经纬度与日期，采光仅为视觉情境。'},
        {'id': 'assets', 'status': 'warning', 'description': '家具为本项目自建参数化预览模型，尚未通过专业 hero 资产审核；正式交付门禁不放行。'},
    ]
    for name, data in [('scene.json', scene), ('asset_manifest.json', assets), ('uncertainties.json', uncertainties)]:
        (DEST / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Created {len(scene['walls'])} walls, {len(scene['openings'])} openings, {len(scene['objects'])} objects, {len(scene['cameras'])} cameras")


if __name__ == '__main__':
    main()
