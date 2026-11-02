import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from archviz.models import AssetManifest, SceneSnapshot


@pytest.fixture
def scene():
    source = {"kind": "measured", "reference": "test-measurement"}
    return SceneSnapshot.model_validate({
        "project_id": "test_home", "revision": 1, "units": "m", "site": {"true_north_offset_rad": 0},
        "levels": [{"id": "level_1", "ceiling_height_m": 2.7, "source": source}],
        "walls": [
            {"id": "wall_s", "level_id": "level_1", "path_xy_m": [[0, 0], [5, 0]], "thickness_m": 0.2, "height_m": 2.7, "source": source},
            {"id": "wall_e", "level_id": "level_1", "path_xy_m": [[5, 0], [5, 5]], "thickness_m": 0.2, "height_m": 2.7, "source": source},
            {"id": "wall_n", "level_id": "level_1", "path_xy_m": [[5, 5], [0, 5]], "thickness_m": 0.2, "height_m": 2.7, "source": source},
            {"id": "wall_w", "level_id": "level_1", "path_xy_m": [[0, 5], [0, 0]], "thickness_m": 0.2, "height_m": 2.7, "source": source},
        ],
        "openings": [{"id": "window_s", "type": "window", "host_wall_id": "wall_s", "offset_from_start_m": 1, "width_m": 1.5, "height_m": 1.4, "sill_height_m": 0.8, "source": source}],
        "rooms": [{"id": "living", "name": "Living", "level_id": "level_1", "boundary_xy_m": [[0, 0], [5, 0], [5, 5], [0, 5]]}],
        "objects": [{"id": "sofa", "category": "sofa", "room_id": "living", "asset_id": "asset_sofa", "quality_tier": "hero", "transform": {"position_m": [2, 2, 0]}, "dimensions_m": [1.6, 0.8, 0.9]}],
        "cameras": [{"id": "camera_still", "type": "perspective", "position_m": [2, 1, 1.5]}, {"id": "camera_pano", "type": "equirectangular", "position_m": [2, 1, 1.5], "resolution_px": [8192, 4096]}],
    })


@pytest.fixture
def assets():
    return AssetManifest.model_validate({"assets": [{"asset_id": "asset_sofa", "category": "sofa", "quality_tier": "custom_fixture", "generator": "sofa", "license": {"license_id": "self-authored-fixture", "commercial_use_allowed": True}}]})
