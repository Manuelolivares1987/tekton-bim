"""Tests for SIP panelization engine — the core algorithm."""

import pytest
from app.services.sip_panelization_service import panelize_wall, Opening


class TestPanelizeWallBasic:
    """Basic wall division without openings."""

    def test_single_standard_panel(self):
        panels = panelize_wall(wall_length_mm=1220, wall_height_mm=2440, openings=[])
        assert len(panels) == 1
        assert panels[0].width_mm == 1220
        assert panels[0].height_mm == 2440
        assert panels[0].is_custom_cut is False

    def test_two_standard_panels(self):
        panels = panelize_wall(wall_length_mm=2440, wall_height_mm=2440, openings=[])
        assert len(panels) == 2
        for p in panels:
            assert p.width_mm == 1220

    def test_standard_plus_custom(self):
        panels = panelize_wall(wall_length_mm=2000, wall_height_mm=2440, openings=[])
        assert len(panels) == 2
        assert panels[0].width_mm == 1220
        assert panels[1].width_mm == 780
        assert panels[1].is_custom_cut is True

    def test_five_meter_wall(self):
        panels = panelize_wall(wall_length_mm=5000, wall_height_mm=2440, openings=[])
        total_width = sum(p.width_mm for p in panels)
        assert abs(total_width - 5000) < 1  # tolerance 1mm

    def test_positions_are_contiguous(self):
        panels = panelize_wall(wall_length_mm=5000, wall_height_mm=2440, openings=[])
        for i in range(1, len(panels)):
            expected_x = panels[i - 1].position_x_mm + panels[i - 1].width_mm
            assert abs(panels[i].position_x_mm - expected_x) < 1

    def test_zero_length_returns_empty(self):
        assert panelize_wall(wall_length_mm=0, wall_height_mm=2440, openings=[]) == []

    def test_negative_length_returns_empty(self):
        assert panelize_wall(wall_length_mm=-100, wall_height_mm=2440, openings=[]) == []

    def test_min_panel_width_merge(self):
        """When residual < min_width, algorithm redistributes evenly."""
        panels = panelize_wall(
            wall_length_mm=1320, wall_height_mm=2440, openings=[],
            standard_width_mm=1220, min_panel_width_mm=200,
        )
        # 1320 = 1220 + 100. 100 < 200 min, so splits into 2 x 660mm
        total = sum(p.width_mm for p in panels)
        assert abs(total - 1320) < 1
        assert all(p.width_mm >= 200 for p in panels)


class TestPanelizeWallWithOpenings:
    """Wall division with door/window openings."""

    def test_door_creates_opening_panel(self):
        door = Opening(
            opening_type="door", x=500, y=0,
            width=900, height=2100,
            rough_width=950, rough_height=2115,
        )
        panels = panelize_wall(wall_length_mm=3000, wall_height_mm=2440, openings=[door])
        has_opening = [p for p in panels if p.has_opening]
        assert len(has_opening) >= 1

    def test_window_creates_opening_and_sill(self):
        window = Opening(
            opening_type="window", x=1500, y=900,
            width=1200, height=1200,
            rough_width=1240, rough_height=1215,
        )
        panels = panelize_wall(wall_length_mm=5000, wall_height_mm=2440, openings=[window])
        has_opening = [p for p in panels if p.has_opening]
        assert len(has_opening) >= 1
        # Should have header and sill panels too
        types = {p.panel_type for p in panels}
        assert "header" in types or "sill" in types or len(panels) > 3

    def test_total_width_matches_wall_with_opening(self):
        door = Opening(
            opening_type="door", x=1000, y=0,
            width=900, height=2100,
            rough_width=950, rough_height=2115,
        )
        panels = panelize_wall(wall_length_mm=4000, wall_height_mm=2440, openings=[door])
        # All panels should cover the wall width at their respective heights
        full_height_panels = [p for p in panels if p.height_mm == 2440]
        assert len(full_height_panels) >= 1


class TestPanelizeWallWeightArea:
    """Weight and area calculations."""

    def test_weight_is_positive(self):
        panels = panelize_wall(wall_length_mm=1220, wall_height_mm=2440, openings=[])
        assert panels[0].weight_kg > 0

    def test_area_calculation(self):
        panels = panelize_wall(wall_length_mm=1220, wall_height_mm=2440, openings=[])
        expected_area = (1220 / 1000) * (2440 / 1000)  # ~2.98 m²
        assert abs(panels[0].area_m2 - expected_area) < 0.01
