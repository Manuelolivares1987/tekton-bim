"""Integration test: full wall lifecycle flow.

Tests the complete sequence:
  draw wall → add opening → verify assembly → delete wall → verify cleanup
"""

import asyncio

import pytest

from app.db.session import SessionLocal, init_db
from app.models.bim_panel import BimPanel
from app.models.bim_wall import BimWall
from app.models.project import Project
from app.services.bim_wall_service import BimWallService


@pytest.fixture(scope="module")
def db():
    asyncio.run(init_db())
    session = SessionLocal()
    project = session.query(Project).filter(Project.name == "__integration__").first()
    if not project:
        project = Project(name="__integration__")
        session.add(project)
        session.commit()
    yield session
    session.close()


@pytest.fixture(scope="module")
def project_id(db):
    return db.query(Project).filter(Project.name == "__integration__").first().id


class TestFullWallLifecycle:
    """draw → opening → assembly check → delete → cleanup."""

    def test_full_lifecycle(self, db, project_id):
        svc = BimWallService(db)

        # ── STEP 1: Draw wall ──
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=6000, end_z_mm=0,
            height_mm=2440, thickness_mm=136,
        )
        wall_id = result["wall"]["id"]
        initial_panels = len(result["panels"])
        assert result["wall"]["length_mm"] == 6000
        assert result["wall"]["rotation_deg"] == 0
        assert initial_panels >= 4  # 6000/1220 ≈ 5 panels

        # Verify panels sum to wall length
        total_width = sum(p["width_mm"] for p in result["panels"])
        assert abs(total_width - 6000) < 1

        # Verify framing has continuous plates
        plate_types = {f["member_type"] for f in result["framing"]}
        assert "bottom_plate" in plate_types
        assert "top_plate" in plate_types
        assert "stud" in plate_types  # end studs

        # ── STEP 2: Add window ──
        result2 = svc.add_opening(
            wall_id=wall_id,
            opening_type="window",
            position_along_mm=2500,
            position_y_mm=900,
            width_mm=1200,
            height_mm=1200,
        )
        assert len(result2["openings"]) == 1
        assert result2["openings"][0]["opening_type"] == "window"
        # Panels should have changed (opening splits panels)
        assert len(result2["panels"]) != initial_panels

        # Verify at least one panel has opening
        panels_with_opening = [p for p in result2["panels"] if p["has_opening"]]
        assert len(panels_with_opening) >= 1

        # ── STEP 3: Add door ──
        result3 = svc.add_opening(
            wall_id=wall_id,
            opening_type="door",
            position_along_mm=500,
            position_y_mm=0,
            width_mm=900,
            height_mm=2100,
        )
        assert len(result3["openings"]) == 2

        # ── STEP 4: Verify full assembly ──
        assembly = svc.get_wall_assembly(wall_id)
        assert assembly["wall"]["id"] == wall_id
        assert len(assembly["panels"]) > 0
        assert len(assembly["framing"]) > 0
        assert len(assembly["openings"]) == 2

        # All panels should belong to this wall
        for p in assembly["panels"]:
            panel_in_db = db.query(BimPanel).filter(BimPanel.id == p["id"]).first()
            assert panel_in_db is not None
            assert panel_in_db.wall_id == wall_id

        # ── STEP 5: Remove one opening ──
        window_id = assembly["openings"][0]["id"]
        result4 = svc.remove_opening(wall_id, window_id)
        assert len(result4["openings"]) == 1

        # ── STEP 6: Delete wall ──
        svc.delete_wall(wall_id)

        # Verify wall gone
        wall_in_db = db.query(BimWall).filter(BimWall.id == wall_id).first()
        assert wall_in_db is None

        # Verify panels cascaded
        panels_in_db = db.query(BimPanel).filter(BimPanel.wall_id == wall_id).all()
        assert len(panels_in_db) == 0


class TestMultiWallProject:
    """Multiple walls in one project."""

    def test_two_perpendicular_walls(self, db, project_id):
        svc = BimWallService(db)

        # Horizontal wall
        r1 = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
        )
        # Vertical wall from end of first
        r2 = svc.draw_wall(
            project_id=project_id,
            start_x_mm=5000, start_z_mm=0,
            end_x_mm=5000, end_z_mm=4000,
        )

        assert r1["wall"]["rotation_deg"] == 0    # horizontal
        assert r2["wall"]["rotation_deg"] == 90   # vertical

        all_walls = svc.list_walls(project_id)
        assert len(all_walls) >= 2

        # Cleanup
        svc.delete_wall(r1["wall"]["id"])
        svc.delete_wall(r2["wall"]["id"])

    def test_joint_types(self, db, project_id):
        """Verify different joint types produce different framing."""
        svc = BimWallService(db)

        # Same geometry, different joints
        for jt in ["tablilla_osb", "lumber_spline", "double_stud"]:
            r = svc.draw_wall(
                project_id=project_id,
                start_x_mm=0, start_z_mm=0,
                end_x_mm=3660, end_z_mm=0,
                joint_type=jt,
            )
            types = {f["member_type"] for f in r["framing"]}

            if jt == "tablilla_osb":
                assert "tablilla_osb" in types
                assert "connection_stud" not in types
            elif jt == "lumber_spline":
                assert "connection_stud" in types
                assert "tablilla_osb" not in types
            elif jt == "double_stud":
                assert "connection_stud" in types
                conn_count = sum(1 for f in r["framing"] if f["member_type"] == "connection_stud")
                assert conn_count == 4  # 2 per joint × 2 joints

            svc.delete_wall(r["wall"]["id"])
