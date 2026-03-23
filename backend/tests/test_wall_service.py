"""Tests for BimWallService — wall creation, panelization orchestration, framing."""

import pytest
import asyncio
from app.db.session import init_db, SessionLocal
from app.services.bim_wall_service import BimWallService
from app.models.project import Project


@pytest.fixture(scope="module")
def db():
    """Create a fresh database session for tests."""
    asyncio.run(init_db())
    session = SessionLocal()
    # Ensure test project exists
    project = session.query(Project).filter(Project.name == "__test__").first()
    if not project:
        project = Project(name="__test__", description="Test project")
        session.add(project)
        session.commit()
    yield session
    session.close()


@pytest.fixture(scope="module")
def project_id(db):
    return db.query(Project).filter(Project.name == "__test__").first().id


class TestDrawWall:
    def test_horizontal_wall(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
        )
        wall = result["wall"]
        assert wall["length_mm"] == 3660
        assert wall["rotation_deg"] == 0
        assert len(result["panels"]) == 3  # 3 x 1220mm
        svc.delete_wall(wall["id"])

    def test_vertical_wall(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=0, end_z_mm=2440,
        )
        wall = result["wall"]
        assert wall["length_mm"] == 2440
        assert wall["rotation_deg"] == 90
        assert len(result["panels"]) == 2
        svc.delete_wall(wall["id"])

    def test_panels_are_contiguous(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
        )
        panels = result["panels"]
        total = sum(p["width_mm"] for p in panels)
        assert abs(total - 5000) < 1
        svc.delete_wall(result["wall"]["id"])

    def test_auto_labels(self, db, project_id):
        svc = BimWallService(db)
        r1 = svc.draw_wall(project_id=project_id, start_x_mm=0, start_z_mm=0, end_x_mm=2000, end_z_mm=0)
        r2 = svc.draw_wall(project_id=project_id, start_x_mm=0, start_z_mm=1000, end_x_mm=2000, end_z_mm=1000)
        assert r1["wall"]["label"] != r2["wall"]["label"]
        svc.delete_wall(r1["wall"]["id"])
        svc.delete_wall(r2["wall"]["id"])


class TestFramingAssembly:
    def test_has_continuous_plates(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
        )
        framing = result["framing"]
        types = {f["member_type"] for f in framing}
        assert "bottom_plate" in types
        assert "top_plate" in types
        svc.delete_wall(result["wall"]["id"])

    def test_studs_only_at_ends(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
        )
        studs = [f for f in result["framing"] if f["member_type"] == "stud"]
        assert len(studs) == 2  # only at wall ends
        svc.delete_wall(result["wall"]["id"])

    def test_tablilla_osb_at_joints(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
            joint_type="tablilla_osb",
        )
        tablillas = [f for f in result["framing"] if f["member_type"] == "tablilla_osb"]
        assert len(tablillas) == 2  # 2 joints (3 panels)
        svc.delete_wall(result["wall"]["id"])

    def test_lumber_spline_at_joints(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
            joint_type="lumber_spline",
        )
        conn_studs = [f for f in result["framing"] if f["member_type"] == "connection_stud"]
        assert len(conn_studs) == 2
        svc.delete_wall(result["wall"]["id"])

    def test_double_stud_at_joints(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3660, end_z_mm=0,
            joint_type="double_stud",
        )
        conn_studs = [f for f in result["framing"] if f["member_type"] == "connection_stud"]
        assert len(conn_studs) == 4  # 2 per joint x 2 joints
        svc.delete_wall(result["wall"]["id"])


class TestOpenings:
    def test_add_window_regenerates(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
        )
        wall_id = result["wall"]["id"]
        panels_before = len(result["panels"])

        result2 = svc.add_opening(
            wall_id=wall_id,
            opening_type="window",
            position_along_mm=2000,
            position_y_mm=900,
            width_mm=1200,
            height_mm=1200,
        )
        assert len(result2["openings"]) == 1
        assert len(result2["panels"]) != panels_before  # should change
        svc.delete_wall(wall_id)

    def test_remove_opening_restores(self, db, project_id):
        svc = BimWallService(db)
        result = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
        )
        wall_id = result["wall"]["id"]
        panels_no_opening = len(result["panels"])

        result2 = svc.add_opening(
            wall_id=wall_id, opening_type="door",
            position_along_mm=1500, position_y_mm=0,
            width_mm=900, height_mm=2100,
        )
        opening_id = result2["openings"][0]["id"]

        result3 = svc.remove_opening(wall_id, opening_id)
        assert len(result3["openings"]) == 0
        assert len(result3["panels"]) == panels_no_opening
        svc.delete_wall(wall_id)
