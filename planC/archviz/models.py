"""Canonical Scene contracts. Extra design metadata is retained across revisions."""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Finite = Annotated[float, Field(allow_inf_nan=False)]
Positive = Annotated[Finite, Field(gt=0)]
Nonnegative = Annotated[Finite, Field(ge=0)]
Vec2 = tuple[Finite, Finite]
Vec3 = tuple[Finite, Finite, Finite]
Size3 = tuple[Positive, Positive, Positive]
Channel = Annotated[Finite, Field(ge=0, le=1)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
EntityID = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]{0,127}$")]


class Contract(BaseModel):
    model_config = ConfigDict(extra="allow", validate_assignment=True, allow_inf_nan=False)


class SourceEvidence(Contract):
    kind: Literal["measured", "user_confirmed", "cad", "image_inferred", "designer_proposed", "unknown"] = "unknown"
    reference: str | None = None
    confidence: Annotated[Finite, Field(ge=0, le=1)] | None = None


class CoordinateSystem(Contract):
    handedness: Literal["right"] = "right"
    up: Literal["+Z"] = "+Z"
    north: Literal["+Y"] = "+Y"
    angles: Literal["radians"] = "radians"


class Site(Contract):
    latitude: Annotated[Finite, Field(ge=-90, le=90)] | None = None
    longitude: Annotated[Finite, Field(ge=-180, le=180)] | None = None
    timezone: str | None = None
    true_north_offset_rad: Finite | None = None


class Level(Contract):
    id: EntityID
    elevation_m: Finite = 0
    ceiling_height_m: Positive
    source: SourceEvidence = Field(default_factory=SourceEvidence)


class Wall(Contract):
    id: EntityID
    level_id: EntityID
    path_xy_m: list[Vec2] = Field(min_length=2, max_length=2)
    thickness_m: Positive
    height_m: Positive
    structural_state: Literal["load_bearing", "non_load_bearing", "unknown"] = "unknown"
    demolition_status: Literal["existing", "proposed", "remove"] = "existing"
    source: SourceEvidence = Field(default_factory=SourceEvidence)

    @model_validator(mode="after")
    def nonzero(self):
        if self.path_xy_m[0] == self.path_xy_m[1]:
            raise ValueError("Wall endpoints must differ")
        return self


class Opening(Contract):
    id: EntityID
    type: Literal["door", "window", "passage"]
    host_wall_id: EntityID
    offset_from_start_m: Nonnegative
    width_m: Positive
    height_m: Positive
    sill_height_m: Nonnegative = 0
    source: SourceEvidence = Field(default_factory=SourceEvidence)


class Room(Contract):
    id: EntityID
    name: str
    level_id: EntityID
    boundary_xy_m: list[Vec2] = Field(min_length=3)
    floor_material_id: EntityID | None = None
    source: SourceEvidence = Field(default_factory=SourceEvidence)


class Transform(Contract):
    position_m: Vec3
    rotation_euler_rad: Vec3 = (0, 0, 0)
    scale: Size3 = (1, 1, 1)


class SceneObject(Contract):
    id: EntityID
    category: str
    room_id: EntityID
    asset_id: EntityID | None = None
    quality_tier: Literal["hero", "standard", "procedural", "background", "custom_fixture"] = "standard"
    transform: Transform
    dimensions_m: Size3
    material_id: EntityID | None = None
    source: SourceEvidence = Field(default_factory=SourceEvidence)
    support_object_id: EntityID | None = None
    contact_exceptions: list[EntityID] = Field(default_factory=list)


class Material(Contract):
    id: EntityID
    type: str = "pbr"
    asset_id: EntityID | None = None
    base_color: HexColor | tuple[Channel, Channel, Channel] = "#cccccc"
    roughness: Channel = 0.5
    metallic: Channel = 0.0
    texture_repeat_m: tuple[Positive, Positive] = (1.0, 1.0)


class Light(Contract):
    id: EntityID
    type: str


class Camera(Contract):
    id: EntityID
    type: Literal["perspective", "equirectangular", "orthographic"]
    position_m: Vec3
    rotation_euler_rad: Vec3 = (0, 0, 0)
    resolution_px: tuple[Annotated[int, Field(gt=0, le=32768)], Annotated[int, Field(gt=0, le=32768)]] = (1920, 1080)


class Constraint(Contract):
    id: EntityID
    type: str
    severity: Literal["blocker", "error", "warning", "info"] = "blocker"


class SceneSnapshot(Contract):
    schema_version: str = "1.0.0"
    project_id: EntityID
    revision: Annotated[int, Field(ge=1)]
    units: Literal["m"] = "m"
    coordinate_system: CoordinateSystem = Field(default_factory=CoordinateSystem)
    site: Site = Field(default_factory=Site)
    levels: list[Level] = Field(min_length=1)
    walls: list[Wall] = Field(min_length=1)
    openings: list[Opening] = Field(default_factory=list)
    rooms: list[Room] = Field(min_length=1)
    objects: list[SceneObject] = Field(default_factory=list)
    materials: list[Material] = Field(default_factory=list)
    lights: list[Light] = Field(default_factory=list)
    cameras: list[Camera] = Field(default_factory=list)
    constraints: list[Constraint] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def references(self):
        entities = [item for group in (self.levels, self.walls, self.openings, self.rooms, self.objects, self.materials, self.lights, self.cameras, self.constraints) for item in group]
        ids = [item.id for item in entities]
        if len(set(ids)) != len(ids):
            raise ValueError("Entity IDs must be globally unique")
        levels, walls, rooms = {x.id for x in self.levels}, {x.id for x in self.walls}, {x.id for x in self.rooms}
        objects, materials = {x.id for x in self.objects}, {x.id for x in self.materials}
        for wall in self.walls:
            if wall.level_id not in levels:
                raise ValueError(f"Unknown level for {wall.id}")
        for opening in self.openings:
            if opening.host_wall_id not in walls:
                raise ValueError(f"Unknown host wall for {opening.id}")
        for room in self.rooms:
            if room.level_id not in levels or (room.floor_material_id and room.floor_material_id not in materials):
                raise ValueError(f"Unknown level/material for {room.id}")
        for obj in self.objects:
            if obj.room_id not in rooms:
                raise ValueError(f"Unknown room for {obj.id}")
            if obj.material_id and obj.material_id not in materials:
                raise ValueError(f"Unknown material for {obj.id}")
            if obj.support_object_id and obj.support_object_id not in objects:
                raise ValueError(f"Unknown support for {obj.id}")
            if any(other not in objects | walls for other in obj.contact_exceptions):
                raise ValueError(f"Unknown contact exception for {obj.id}")
            if obj.id in obj.contact_exceptions or obj.support_object_id == obj.id:
                raise ValueError(f"Self contact/support is invalid for {obj.id}")
        return self


class PatchOperation(Contract):
    op: Literal["translate", "rotate", "set_material", "update_wall", "remove_wall"]
    object_id: EntityID
    delta_m: Vec3 | None = None
    rotation_euler_rad: Vec3 | None = None
    material_id: EntityID | None = None
    values: dict[str, Any] | None = None

    @model_validator(mode="after")
    def payload(self):
        required = {"translate": "delta_m", "rotate": "rotation_euler_rad", "set_material": "material_id", "update_wall": "values"}
        if self.op in required and getattr(self, required[self.op]) is None:
            raise ValueError(f"{self.op} requires {required[self.op]}")
        return self


class ScenePatch(Contract):
    project_id: EntityID
    expected_revision: Annotated[int, Field(ge=1)]
    patch_id: EntityID
    requested_by: str = "design_agent"
    operations: list[PatchOperation] = Field(min_length=1, max_length=100)
    validate_before_commit: Literal[True] = True


class License(Contract):
    license_id: str
    commercial_use_allowed: bool
    source_url: str | None = None
    attribution_required: bool = False


class AssetRecord(Contract):
    asset_id: EntityID
    name: str = ""
    category: str
    quality_tier: str
    generator: str | None = None
    format: str | None = None
    dimensions_m: Size3 | None = None
    file_uri: str | None = None
    file_sha256: str | None = None
    license: License
    approved: bool = False
    approval_evidence: str | None = None
    validation: dict[str, Any] = Field(default_factory=dict)


class AssetManifest(Contract):
    assets: list[AssetRecord]

    @model_validator(mode="after")
    def unique(self):
        if len({x.asset_id for x in self.assets}) != len(self.assets):
            raise ValueError("Duplicate asset ID")
        return self


class Issue(Contract):
    rule_id: str
    severity: Literal["blocker", "error", "warning", "info"]
    object_ids: list[str] = Field(default_factory=list)
    description: str
    measured_value: Any = None
    expected_condition: str | None = None


class QAReport(Contract):
    project_id: str
    scene_revision: int
    status: Literal["pass", "warning", "fail", "needs_confirmation"]
    issues: list[Issue] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)

    @classmethod
    def from_issues(cls, scene: SceneSnapshot, issues: list[Issue], **kwargs):
        status = "fail" if any(i.severity in {"blocker", "error"} for i in issues) else "warning" if any(i.severity == "warning" for i in issues) else "pass"
        return cls(project_id=scene.project_id, scene_revision=scene.revision, status=status, issues=issues, **kwargs)

    @property
    def passed(self):
        return self.status in {"pass", "warning"}
