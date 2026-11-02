#!/usr/bin/env python3
"""Audit the exported sunlit geometry against reviewed plan constraints.

This checks the deterministic scene and its furniture footprints. It never marks
an AI image as geometrically exact. Visual review is a separate signed record.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = ROOT / 'public/concepts/spatial/sunlit'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def on_segment(p, a, b, tolerance=1e-7):
    cross = (p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0])
    return abs(cross) <= tolerance and min(a[0], b[0])-tolerance <= p[0] <= max(a[0], b[0])+tolerance and min(a[1], b[1])-tolerance <= p[1] <= max(a[1], b[1])+tolerance


def inside(p, polygon, tolerance=.005):
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if on_segment(p, a, b, tolerance):
            return True
    contained = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:
            contained = not contained
    return contained


def footprint(item):
    angle = item.get('rotation', item.get('rotationY', 0)) or 0
    if isinstance(angle, list):
        angle = angle[1]
    c, s = math.cos(angle), math.sin(angle)
    w, d = item['width']/2, item['depth']/2
    # Three.js rotation about Y: x'=c*x+s*z, z'=-s*x+c*z.
    return [[item['x'] + c*x+s*z, item['z']-s*x+c*z] for x, z in [(-w,-d),(w,-d),(w,d),(-w,d)]]


def item_base(item):
    return item.get('base', item.get('baseHeight', 0))


def overlap(poly_a, poly_b, tolerance=.008):
    """Strict SAT overlap; touching surfaces and <=8mm contact are allowed."""
    for poly in (poly_a, poly_b):
        for a, b in zip(poly, poly[1:]+poly[:1]):
            axis = (a[1]-b[1], b[0]-a[0])
            length = math.hypot(*axis)
            if length < 1e-9:
                continue
            axis = (axis[0]/length, axis[1]/length)
            pa = [p[0]*axis[0]+p[1]*axis[1] for p in poly_a]
            pb = [p[0]*axis[0]+p[1]*axis[1] for p in poly_b]
            if min(max(pa), max(pb))-max(min(pa), min(pb)) <= tolerance:
                return False
    return True


def wall_footprint(wall):
    start = wall.get('start', [wall.get('x1'), wall.get('z1')])
    end = wall.get('end', [wall.get('x2'), wall.get('z2')])
    t = wall.get('thickness', .22)
    # buildScene.wall uses length along its axis, thickness across it.
    x1, x2 = sorted((start[0], end[0]))
    z1, z2 = sorted((start[1], end[1]))
    if abs(x2-x1) < 1e-8:
        x1 -= t/2
        x2 += t/2
    if abs(z2-z1) < 1e-8:
        z1 -= t/2
        z2 += t/2
    return [[x1,z1],[x2,z1],[x2,z2],[x1,z2]]


def segment_matches(a, b, tolerance=.012):
    return (distance(a['start'], b['start']) <= tolerance and distance(a['end'], b['end']) <= tolerance) or (distance(a['start'], b['end']) <= tolerance and distance(a['end'], b['start']) <= tolerance)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene', type=Path, default=DEFAULT_BASE/'references/scene.json')
    parser.add_argument('--constraints', type=Path, default=DEFAULT_BASE/'constraints.json')
    parser.add_argument('--report', type=Path, default=DEFAULT_BASE/'geometry-check.json')
    parser.add_argument('--artifacts', action='store_true', help='Also require all nine final deterministic renders and matching per-view hashes.')
    args = parser.parse_args()
    constraints = json.loads(args.constraints.read_text())
    errors, warnings, checks = [], [], []

    def check(name, passed, details=None):
        checks.append({'name': name, 'passed': bool(passed), 'details': details})
        if not passed:
            errors.append({'name': name, 'details': details})

    for source in constraints['sources']:
        if 'sha256' in source:
            path = ROOT/source['path']
            check('source_hash:'+source['id'], path.exists() and digest(path) == source['sha256'], source['path'])

    if not args.scene.exists():
        check('exported_scene_exists', False, str(args.scene))
        scene = {}
    else:
        scene = json.loads(args.scene.read_text())
        check('units_metres', scene.get('units') == 'm')
        required = ('rooms', 'walls', 'openings', 'furniture', 'cameras', 'outline')
        for key in required:
            check('scene_contains:'+key, bool(scene.get(key)))

    if scene:
        outline = scene.get('outline', [])
        expected = constraints['geometry']['outline']['vertices']
        check('twenty_outer_vertices', len(outline) == 20, {'actual':len(outline),'expected':20})
        check('outer_contour_coordinates', len(outline) == len(expected) and all(distance(a,b) < .005 for a,b in zip(outline,expected)))
        check('orthogonal_outer_contour', all(abs(a[0]-b[0]) < 1e-5 or abs(a[1]-b[1]) < 1e-5 for a,b in zip(outline,outline[1:]+outline[:1])))
        rooms = {r['id']:r for r in scene.get('rooms', [])}
        for room_id in constraints['geometry']['roomIds']:
            check('room_present:'+room_id, room_id in rooms)
        master_poly=rooms.get('master',{}).get('polygon',[])
        expected_master=constraints['geometry']['physicalRoomBoundaries']['master']
        check('master_six_vertex_physical_boundary',len(master_poly)==6 and all(distance(a,b)<.005 for a,b in zip(master_poly,expected_master)))
        for rule in constraints['geometry']['sharedWalls']:
            a, b = rule['start'], rule['end']
            matching = [w for w in scene.get('walls',[]) if (w.get('base',0) < .01 and w.get('height',0) >= 2.6 and on_segment(w.get('start',[w.get('x1'),w.get('z1')]),a,b,.005) and on_segment(w.get('end',[w.get('x2'),w.get('z2')]),a,b,.005))]
            spans = []
            along_x = abs(a[0]-b[0]) > .01
            axis = 0 if along_x else 1
            for wall in matching:
                start, end = wall.get('start',[wall.get('x1'),wall.get('z1')]), wall.get('end',[wall.get('x2'),wall.get('z2')])
                spans.append(sorted((start[axis],end[axis])))
            spans.sort()
            covered = min(a[axis],b[axis])
            for start,end in spans:
                if start <= covered+.005:
                    covered = max(covered,end)
            check('shared_solid_wall:'+rule['id'], covered >= max(a[axis],b[axis])-.005, {'matchingWallIds':[w['id'] for w in matching]})

        openings = scene.get('openings',[])
        windows = [o for o in openings if o.get('kind') == 'window']
        expected_windows = constraints['geometry']['windows']
        check('exactly_nine_windows', len(windows) == len(expected_windows), {'actual':len(windows),'expected':len(expected_windows)})
        for expected_window in expected_windows:
            matches = [o for o in windows if segment_matches(o, expected_window)]
            check('window_position:'+expected_window['id'],len(matches) == 1)
            if len(matches)==1:
                check('window_sill:'+expected_window['id'], abs(matches[0].get('sill',-99)-expected_window['sill']) <= .012)
                check('window_height:'+expected_window['id'], abs(matches[0].get('height',-99)-expected_window['height']) <= .012)
        for door in constraints['geometry']['doors']:
            matches = [o for o in openings if o.get('kind') == 'door' and segment_matches(o, door)]
            check('door_position:'+door['id'], len(matches)==1)
        check('no_master_or_guest_side_windows', not any(abs(o['start'][0]-o['end'][0]) < .01 and (abs(o['start'][0]+.11)<.01 or abs(o['start'][0]-1.99)<.01) for o in windows))
        master_walls = constraints['geometry']['masterEntranceReturns']
        for expected_wall in master_walls:
            matches = [w for w in scene.get('walls',[]) if w.get('base',0) < .01 and w.get('height',0) >= 2.6 and segment_matches({'start':w.get('start',[w.get('x1'),w.get('z1')]),'end':w.get('end',[w.get('x2'),w.get('z2')])},expected_wall)]
            check('master_entrance_return:'+expected_wall['id'], bool(matches))

        door_groups={g.get('side'):g for g in scene.get('doorGroups',[])}
        for side,panels in (('west',5),('south',4)):
            group=door_groups.get(side,{})
            check('kitchen_door_panel_count:'+side,group.get('panels')==panels)
            check('kitchen_door_stacking:'+side,group.get('stackToward')=='start')
            check('kitchen_door_default_open:'+side,group.get('default')=='open')
        south_group=door_groups.get('south',{})
        fixed_extension=[w for w in scene.get('walls',[]) if w.get('name')=='kitchen-fixed-low-wall' and abs(w.get('height',0)-.88)<.01]
        check('kitchen_south_fixed_low_enclosure',len(fixed_extension)==1)
        original_return=[w for w in scene.get('walls',[]) if w.get('name')=='kitchen-exterior-return' and segment_matches({'start':w['start'],'end':w['end']},constraints['geometry']['kitchenEnclosure']['originalSoutheastReturn'])]
        check('kitchen_original_southeast_return_retained',len(original_return)==1)

        furniture = scene.get('furniture',[])
        objects = {item['id']:item for item in furniture}
        for item in furniture:
            if not all(k in item for k in ('x','z','width','depth','roomId')):
                check('furniture_schema:'+item.get('id','unknown'), False)
                continue
            poly = footprint(item)
            bounds = constraints['geometry']['physicalRoomBoundaries'].get(item['roomId'])
            # Physical wall positions have priority over navigation polygons.
            boundary_list=[bounds] if bounds else []
            for extra_room in constraints['placement'].get('allowedOpenZoneCrossings',{}).get(item['id'],[]):
                boundary_list.append(constraints['geometry']['physicalRoomBoundaries'][extra_room])
            check('furniture_inside_room:'+item['id'], bool(boundary_list) and all(any(inside(p,boundary,.008) for boundary in boundary_list) for p in poly), {'roomId':item['roomId'],'footprint':poly,'allowedOpenZoneCrossings':constraints['placement'].get('allowedOpenZoneCrossings',{}).get(item['id'],[])})
            base = item_base(item)
            height = item.get('height', .75)
            hits = []
            for wall in scene.get('walls',[]):
                wall_base = wall.get('base',0)
                if min(base+height,wall_base+wall.get('height',2.7))-max(base,wall_base) <= .008:
                    continue
                if overlap(poly,wall_footprint(wall)):
                    hits.append(wall['id'])
            check('furniture_clear_of_walls:'+item['id'],not hits,hits)
            blocked_doors=[]
            for door in constraints['geometry']['doors']:
                if door['roomId'] != item['roomId']:
                    continue
                a,b=door['start'],door['end']
                if abs(a[0]-b[0]) < .01:
                    zone=[[a[0]-.13,min(a[1],b[1])],[a[0]+.13,min(a[1],b[1])],[a[0]+.13,max(a[1],b[1])],[a[0]-.13,max(a[1],b[1])]]
                else:
                    zone=[[min(a[0],b[0]),a[1]-.13],[max(a[0],b[0]),a[1]-.13],[max(a[0],b[0]),a[1]+.13],[min(a[0],b[0]),a[1]+.13]]
                if base < 2.1 and overlap(poly,zone):
                    blocked_doors.append(door['id'])
            check('furniture_clear_of_door_thresholds:'+item['id'],not blocked_doors,blocked_doors)
        allowed = {frozenset(pair) for pair in constraints['placement'].get('allowedOverlaps',[])}
        for i,a in enumerate(furniture):
            if not all(k in a for k in ('x','z','width','depth','roomId')):
                continue
            for b in furniture[i+1:]:
                if not all(k in b for k in ('x','z','width','depth','roomId')):
                    continue
                if a['roomId'] != b['roomId'] or frozenset((a['id'],b['id'])) in allowed:
                    continue
                if a.get('parentId') == b['id'] or b.get('parentId') == a['id'] or (a.get('groupId') and a.get('groupId') == b.get('groupId')):
                    continue
                if min(item_base(a)+a.get('height',.75),item_base(b)+b.get('height',.75))-max(item_base(a),item_base(b)) <= .008:
                    continue
                if overlap(footprint(a),footprint(b)):
                    check('furniture_pair_clear:'+a['id']+'|'+b['id'],False)
        for rule in constraints['placement'].get('rules',[]):
            selectors = rule['roles']
            selected=[]
            for role in selectors:
                matches=[item for item in furniture if item.get('role',item['id']) == role]
                if len(matches) != 1:
                    check('placement_role:'+role,False,{'count':len(matches)})
                    break
                selected.append(matches[0])
            else:
                kind=rule['kind']
                if kind == 'range':
                    item=selected[0]
                    value=item[rule['property']]
                    check('placement_rule:'+rule['id'],rule['min']<=value<=rule['max'],{'actual':value,'range':[rule['min'],rule['max']]})
                elif kind == 'order':
                    values=[item[rule['axis']] for item in selected]
                    check('placement_rule:'+rule['id'], all(a<b for a,b in zip(values,values[1:])),values)
                elif kind == 'same_axis':
                    values=[item[rule['axis']] for item in selected]
                    check('placement_rule:'+rule['id'],max(values)-min(values)<=rule['tolerance'],values)
        if 'south-prep-counter' in objects and 'north-counter' in objects and 'east-counter' in objects:
            south=objects['south-prep-counter']; north=objects['north-counter']; east=objects['east-counter']
            south_left=south['x']-south['width']/2
            check('kitchen_south_door_abuts_prep_counter',abs(south_group.get('to',-99)-south_left)<=.005)
            check('kitchen_south_counter_135_by_55',abs(south['width']-1.35)<.005 and abs(south['depth']-.55)<.005)
            check('kitchen_north_counter_230_by_60',abs(north['width']-2.30)<.005 and abs(north['depth']-.60)<.005)
            check('kitchen_L_joint_continuous',abs((east['z']+east['depth']/2)-(south['z']-south['depth']/2))<=.005 and abs((east['x']+east['width']/2)-(south['x']+south['width']/2))<=.005)
            gap=(south['z']-south['depth']/2)-(north['z']+north['depth']/2)
            check('kitchen_counter_static_clearance',gap>=1.20,{'actualM':round(gap,4),'nominalDocumentM':1.29,'basis':'actual exported anchors; nominal is approximate and not surveyed'})
            if abs(gap-1.29)>.01:
                warnings.append(f'当前坐标实际对向台面静态净距{gap:.2f}m；10月28日文档约数为1.29m，二者未冒充相同实测值。')
        if south_group:
            clear=south_group.get('clearOpening',0)
            check('kitchen_south_door_static_opening',clear>=1.25,{'actualM':round(clear,4),'documentTargetRangeM':[1.25,1.30],'dynamicUseNotIncluded':True})
            if clear>1.30+.01:
                warnings.append(f'当前南门组按锚点得到静态开口{clear:.2f}m；旧拟定目标约1.25–1.30m，差异来自边界/叠收约数，不是现场复测。')
        if all(key in objects for key in ('reading-chair','reading-ottoman','side-table','reading-lamp')):
            reading=[objects[key] for key in ('reading-chair','reading-ottoman','side-table','reading-lamp')]
            rightmost=max(max(p[0] for p in footprint(item)) for item in reading)
            wall_inner=8.50-constraints['geometry']['wallThickness']['value']/2
            clearance=wall_inner-rightmost
            check('reading_static_east_access_clearance',clearance>=.85,{'actualM':round(clearance,4),'targetMinimumM':.85,'scope':'declared floor footprints; no person or chair movement included'})
        if all(key in objects for key in ('guest-bed','guest-desk','guest-chair')):
            bed=objects['guest-bed']; desk=objects['guest-desk']; chair=objects['guest-chair']
            aisle=min(p[0] for p in footprint(desk))-max(p[0] for p in footprint(bed))
            chair_gap=min(p[0] for p in footprint(chair))-max(p[0] for p in footprint(bed))
            check('guest_static_bed_desk_aisle',aisle>=1.16,{'actualM':round(aisle,4),'chairExcluded':True})
            check('guest_static_chair_back_gap',chair_gap>=.54,{'actualM':round(chair_gap,4),'onePersonUse':True,'chairMustTuckForPassing':True})
        if 'gaming-chair' in objects:
            chair=objects['gaming-chair']
            clearance=6.33-.11-max(p[0] for p in footprint(chair))
            check('gaming_static_chair_back_gap',clearance>=1.07,{'actualM':round(clearance,4),'scope':'current chair placement, no pullback included'})
        for cam in scene.get('cameras',[]):
            room_id=cam['roomId']
            p=cam['position']
            boundary=constraints['geometry']['physicalRoomBoundaries'].get(room_id)
            check('camera_inside_room:'+cam['id'], bool(boundary) and inside([p[0],p[2]],boundary,.01))
            check('camera_eye_height:'+cam['id'], .90<=p[1]<=2.20, p[1])

        if args.artifacts:
            manifest_path=args.scene.parent/'manifest.json'
            check('reference_manifest_exists',manifest_path.exists())
            manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
            check('reference_manifest_scene_hash',manifest.get('scene',{}).get('sha256')==digest(args.scene))
            glb_path=args.scene.parent/'scene.glb'
            glb_hash=digest(glb_path) if glb_path.exists() else None
            check('reference_manifest_model_hash',bool(glb_hash) and manifest.get('model',{}).get('sha256')==glb_hash)
            check('reference_manifest_structure_hash',bool(scene.get('structureHash')) and manifest.get('structureHash')==scene.get('structureHash'))
            for source in manifest.get('sources',[]):
                source_path=ROOT/source['path']
                check('render_source_hash:'+source['path'],source_path.exists() and digest(source_path)==source['sha256'])
            camera_map={c['id']:c for c in scene.get('cameras',[])}
            for asset_id in constraints['verification']['requiredImageIds']:
                image_path=args.scene.parent/(asset_id+'.png')
                record_path=args.scene.parent/(asset_id+'.render.json')
                check('render_image_exists:'+asset_id,image_path.exists())
                check('render_record_exists:'+asset_id,record_path.exists())
                if not image_path.exists() or not record_path.exists():
                    continue
                record=json.loads(record_path.read_text())
                check('render_image_hash:'+asset_id,digest(image_path)==record.get('sha256'))
                check('render_uses_frozen_structure:'+asset_id,record.get('structureHash')==scene.get('structureHash'))
                check('render_uses_frozen_model:'+asset_id,record.get('sceneGlbSha256')==glb_hash)
                blob=image_path.read_bytes()
                dimensions=list(struct.unpack('>II',blob[16:24])) if blob[:8]==b'\x89PNG\r\n\x1a\n' else None
                check('render_actual_dimensions:'+asset_id,dimensions==[1536,1024] and dimensions==record.get('resolution'),dimensions)
                check('render_all_walls_retained:'+asset_id,record.get('wallsHidden') is False and record.get('ceilingHidden') is False)
                cam=camera_map.get(asset_id,{})
                source_cam=record.get('sourceCamera',{})
                check('render_frozen_camera:'+asset_id,all(source_cam.get(k)==cam.get(k) for k in ('position','target','lensMm')) and bool(cam))
                if cam:
                    x,y,z=cam['position']; actual=record.get('cameraPositionBlender',[])
                    check('render_actual_camera_position:'+asset_id,len(actual)==3 and max(abs(a-b) for a,b in zip(actual,[x,-z,y]))<.002)

    warnings.extend(constraints['limitations'])
    visual_path=args.report.parent/'visual-review.json'
    if visual_path.exists():
        visual=json.loads(visual_path.read_text())
        visual_status=visual.get('status','pending')
    else:
        visual_status='pending'
    report={
        'schemaVersion':1,'checkedAt':datetime.now(timezone.utc).isoformat(),
        'status':'passed' if not errors else 'failed',
        'scope':'Deterministic scene geometry, openings and declared object footprints only. AI-image visual review is independent.',
        'scene':str(args.scene.relative_to(ROOT)) if args.scene.is_relative_to(ROOT) else str(args.scene),
        'sceneSha256':digest(args.scene) if args.scene.exists() else None,
        'constraintsSha256':digest(args.constraints),'checkCount':len(checks),
        'passedCount':sum(c['passed'] for c in checks),'errorCount':len(errors),
        'errors':errors,'checks':checks,'warnings':warnings,
        'visualReview':{'status':visual_status,'file':'visual-review.json' if visual_path.exists() else None,'notCoveredByGeometryChecks':True},
        'artifactAuditIncluded':args.artifacts,
    }
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('status','checkCount','passedCount','errorCount','sceneSha256')},ensure_ascii=False))
    for error in errors:
        print(json.dumps(error,ensure_ascii=False))
    raise SystemExit(0 if not errors else 1)


if __name__ == '__main__':
    main()
