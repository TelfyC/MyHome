"""Deterministic 2D/2.5D constraints, separate from aesthetic review."""
from __future__ import annotations

import math

from .models import Issue, QAReport, SceneSnapshot

EPS = 1e-6


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def on_segment(p, a, b):
    return abs(cross(a, b, p)) < EPS and min(a[0], b[0]) - EPS <= p[0] <= max(a[0], b[0]) + EPS and min(a[1], b[1]) - EPS <= p[1] <= max(a[1], b[1]) + EPS


def segments_intersect(a, b, c, d, proper=False):
    ca, cb, cc, cd = cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
    if ca * cb < -EPS and cc * cd < -EPS:
        return True
    return not proper and (on_segment(a, c, d) or on_segment(b, c, d) or on_segment(c, a, b) or on_segment(d, a, b))


def polygon_edges(poly):
    return list(zip(poly, poly[1:] + poly[:1]))


def normalized_polygon(poly):
    return list(poly[:-1] if len(poly) > 1 and poly[0] == poly[-1] else poly)


def point_inside(p, poly):
    if any(on_segment(p, a, b) for a, b in polygon_edges(poly)):
        return True
    inside = False
    for a, b in polygon_edges(poly):
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def rectangle(center, size, angle):
    cx, cy = center
    width, depth = size
    co, si = math.cos(angle), math.sin(angle)
    return [(cx + x * co - y * si, cy + x * si + y * co) for x, y in [(-width / 2, -depth / 2), (width / 2, -depth / 2), (width / 2, depth / 2), (-width / 2, depth / 2)]]


def polygons_overlap(a, b):
    """Separating axes for convex polygons; touching boundaries do not collide."""
    for poly in (a, b):
        for p, q in polygon_edges(poly):
            axis = (p[1] - q[1], q[0] - p[0])
            ap = [x * axis[0] + y * axis[1] for x, y in a]
            bp = [x * axis[0] + y * axis[1] for x, y in b]
            if min(max(ap), max(bp)) - max(min(ap), min(bp)) <= EPS:
                return False
    return True


def issue(rule, severity, ids, description, measured=None, expected=None):
    return Issue(rule_id=rule, severity=severity, object_ids=list(ids), description=description, measured_value=measured, expected_condition=expected)


def validate_geometry(scene: SceneSnapshot, *, final: bool = False) -> QAReport:
    issues = []
    rooms = {r.id: r for r in scene.rooms}
    levels = {level.id: level for level in scene.levels}
    walls = {wall.id: wall for wall in scene.walls}
    objects = {obj.id: obj for obj in scene.objects}
    footprints = {}

    for room in scene.rooms:
        poly = normalized_polygon(room.boundary_xy_m)
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in polygon_edges(poly))) / 2
        edges = polygon_edges(poly)
        invalid = len(set(poly)) < 3 or area < EPS or len(set(poly)) != len(poly)
        for i, (a, b) in enumerate(edges):
            for j, (c, d) in enumerate(edges):
                if j <= i or (j - i) in (1, len(edges) - 1):
                    continue
                invalid |= segments_intersect(a, b, c, d)
        if invalid:
            issues.append(issue("GEO_001", "blocker", [room.id], "Room polygon is degenerate, repeated, or self-intersecting", area, "Simple implicitly closed polygon with positive area"))

    by_wall = {}
    for opening in scene.openings:
        wall = walls[opening.host_wall_id]
        length = math.dist(*wall.path_xy_m)
        if opening.offset_from_start_m + opening.width_m > length + EPS or opening.sill_height_m + opening.height_m > wall.height_m + EPS:
            issues.append(issue("GEO_002", "blocker", [opening.id, wall.id], "Opening exceeds its host wall", {"wall_length_m": length, "wall_height_m": wall.height_m}, "Opening must fit horizontal and vertical host bounds"))
        for other in by_wall.get(wall.id, []):
            horizontal = min(opening.offset_from_start_m + opening.width_m, other.offset_from_start_m + other.width_m) - max(opening.offset_from_start_m, other.offset_from_start_m)
            vertical = min(opening.sill_height_m + opening.height_m, other.sill_height_m + other.height_m) - max(opening.sill_height_m, other.sill_height_m)
            if horizontal > EPS and vertical > EPS:
                issues.append(issue("GEO_002", "blocker", [opening.id, other.id, wall.id], "Openings overlap on host wall"))
        by_wall.setdefault(wall.id, []).append(opening)

    for i, wall in enumerate(scene.walls):
        if wall.demolition_status == "remove" and wall.structural_state in {"unknown", "load_bearing"}:
            issues.append(issue("STRUCT_001" if wall.structural_state == "load_bearing" else "STRUCT_002", "blocker", [wall.id], "Protected or unknown wall cannot be demolished"))
        a, b = wall.path_xy_m
        for other in scene.walls[i + 1:]:
            if wall.level_id != other.level_id:
                continue
            c, d = other.path_xy_m
            if segments_intersect(a, b, c, d, proper=True):
                issues.append(issue("GEO_003", "error", [wall.id, other.id], "Wall centerlines cross away from a registered junction"))
            if abs(cross(a, b, c)) < EPS and abs(cross(a, b, d)) < EPS:
                axis = 0 if abs(b[0] - a[0]) >= abs(b[1] - a[1]) else 1
                overlap = min(max(a[axis], b[axis]), max(c[axis], d[axis])) - max(min(a[axis], b[axis]), min(c[axis], d[axis]))
                if overlap > EPS:
                    issues.append(issue("GEO_004", "error", [wall.id, other.id], "Collinear wall segments overlap", overlap))

    for obj in scene.objects:
        px, py, pz = obj.transform.position_m
        sx, sy, sz = (d * scale for d, scale in zip(obj.dimensions_m, obj.transform.scale))
        room = rooms[obj.room_id]
        level = levels[room.level_id]
        roll, pitch, yaw = obj.transform.rotation_euler_rad
        if abs(roll) > EPS or abs(pitch) > EPS:
            issues.append(issue("FURN_003", "error", [obj.id], "2.5D constraint engine requires upright objects; arbitrary tilt needs Blender mesh QA"))
        footprint = rectangle((px, py), (sx, sy), yaw)
        footprints[obj.id] = footprint
        room_poly = normalized_polygon(room.boundary_xy_m)
        outside = not all(point_inside(p, room_poly) for p in footprint)
        outside |= any(segments_intersect(a, b, c, d, proper=True) for a, b in polygon_edges(footprint) for c, d in polygon_edges(room_poly))
        if outside:
            issues.append(issue("FURN_001", "error", [obj.id, room.id], "Object oriented footprint leaves its assigned room"))
        if pz < level.elevation_m - 0.01 or pz + sz > level.elevation_m + level.ceiling_height_m + 0.01:
            issues.append(issue("FURN_002", "error", [obj.id], "Object intersects floor or ceiling", [pz, pz + sz]))
        if pz > level.elevation_m + 0.05 and not obj.support_object_id and not getattr(obj, "wall_mounted", False) and not getattr(obj, "ceiling_mounted", False):
            issues.append(issue("FURN_002", "error", [obj.id], "Elevated object has no registered support", pz))
        if obj.support_object_id:
            support = objects[obj.support_object_id]
            support_top = support.transform.position_m[2] + support.dimensions_m[2] * support.transform.scale[2]
            support_size = [support.dimensions_m[i] * support.transform.scale[i] for i in range(2)]
            support_poly = rectangle(support.transform.position_m[:2], support_size, support.transform.rotation_euler_rad[2])
            if abs(pz - support_top) > 0.05 or not all(point_inside(p, support_poly) for p in footprint):
                issues.append(issue("FURN_002", "error", [obj.id, support.id], "Object does not sit on its registered support", {"base_z": pz, "support_top_z": support_top}))
        for wall in scene.walls:
            if wall.level_id != room.level_id or wall.id in obj.contact_exceptions or wall.demolition_status == "remove":
                continue
            a, b = wall.path_xy_m
            length = math.dist(a, b)
            angle = math.atan2(b[1] - a[1], b[0] - a[0])
            wall_rect = rectangle(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (length, wall.thickness_m), angle)
            if not polygons_overlap(footprint, wall_rect):
                continue
            projections = [(p[0] - a[0]) * math.cos(angle) + (p[1] - a[1]) * math.sin(angle) for p in footprint]
            fits_opening = any(min(projections) >= o.offset_from_start_m - EPS and max(projections) <= o.offset_from_start_m + o.width_m + EPS and pz >= level.elevation_m + o.sill_height_m - EPS and pz + sz <= level.elevation_m + o.sill_height_m + o.height_m + EPS for o in by_wall.get(wall.id, []))
            if not fits_opening:
                issues.append(issue("FURN_001", "error", [obj.id, wall.id], "Object intersects a wall outside its openings"))

    for index, obj in enumerate(scene.objects):
        for other in scene.objects[index + 1:]:
            if rooms[obj.room_id].level_id != rooms[other.room_id].level_id:
                continue
            if other.id in obj.contact_exceptions or obj.id in other.contact_exceptions or obj.support_object_id == other.id or other.support_object_id == obj.id:
                continue
            z0, z1 = obj.transform.position_m[2], other.transform.position_m[2]
            h0 = obj.dimensions_m[2] * obj.transform.scale[2]
            h1 = other.dimensions_m[2] * other.transform.scale[2]
            if min(z0 + h0, z1 + h1) - max(z0, z1) > EPS and polygons_overlap(footprints[obj.id], footprints[other.id]):
                issues.append(issue("FURN_001", "error", [obj.id, other.id], "Object bounding prisms overlap; inspect geometry or declare audited contact exception"))

    uncertain = [entity.id for entity in [*scene.levels, *scene.walls, *scene.openings] if entity.source.kind not in {"measured", "user_confirmed", "cad"}]
    if uncertain:
        issues.append(issue("SOURCE_001", "blocker" if final else "warning", uncertain, "Structure includes inferred or unmeasured values; draft preview only", expected="Calibrated structural inputs before final delivery"))
    if scene.site.true_north_offset_rad is None:
        issues.append(issue("LIGHT_001", "warning", [], "True north is unknown; lighting is a visual scenario, not site sun analysis"))
    return QAReport.from_issues(scene, issues)
