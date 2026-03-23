"""Tests for compliance checker — normative validation semaphore."""

import asyncio

import pytest

from app.db.session import SessionLocal, init_db
from app.models.project import Project
from app.services.bim_wall_service import BimWallService
from app.services.compliance_checker import check_project_compliance


@pytest.fixture(scope="module")
def db():
    asyncio.run(init_db())
    session = SessionLocal()
    project = session.query(Project).filter(Project.name == "__compliance__").first()
    if not project:
        project = Project(name="__compliance__")
        session.add(project)
        session.commit()
    yield session
    session.close()


@pytest.fixture(scope="module")
def project_id(db):
    return db.query(Project).filter(Project.name == "__compliance__").first().id


class TestComplianceChecker:
    def test_empty_project_warns(self, db, project_id):
        result = check_project_compliance(db, project_id, "chile")
        assert result["status"] in ("warning", "pass")
        assert result["total_checks"] > 0

    def test_valid_wall_passes(self, db, project_id):
        svc = BimWallService(db)
        r = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
            height_mm=2440,
        )
        wall_id = r["wall"]["id"]

        result = check_project_compliance(db, project_id, "chile")
        wall_checks = [c for c in result["checks"] if c["element_type"] == "wall"]
        # Height 2440mm is within 2300-3050mm range
        height_check = [c for c in wall_checks if c["rule_id"] == "wall_height"]
        assert len(height_check) == 1
        assert height_check[0]["severity"] == "pass"

        svc.delete_wall(wall_id)

    def test_too_short_wall_fails(self, db, project_id):
        svc = BimWallService(db)
        r = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3000, end_z_mm=0,
            height_mm=2000,  # below 2300mm minimum
        )
        wall_id = r["wall"]["id"]

        result = check_project_compliance(db, project_id, "chile")
        height_checks = [c for c in result["checks"] if c["rule_id"] == "wall_height_min"]
        assert len(height_checks) == 1
        assert height_checks[0]["severity"] == "fail"
        assert "2000" in height_checks[0]["message"]

        svc.delete_wall(wall_id)

    def test_long_wall_warns_bracing(self, db, project_id):
        svc = BimWallService(db)
        r = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=10000, end_z_mm=0,  # 10m > 8m bracing limit
        )
        wall_id = r["wall"]["id"]

        result = check_project_compliance(db, project_id, "chile")
        bracing = [c for c in result["checks"] if c["rule_id"] == "wall_bracing"]
        assert len(bracing) == 1
        assert bracing[0]["severity"] == "warning"

        svc.delete_wall(wall_id)

    def test_narrow_door_fails(self, db, project_id):
        svc = BimWallService(db)
        r = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=5000, end_z_mm=0,
        )
        wall_id = r["wall"]["id"]
        svc.add_opening(
            wall_id=wall_id,
            opening_type="door",
            position_along_mm=1000,
            position_y_mm=0,
            width_mm=600,  # below 800mm minimum
            height_mm=2100,
        )

        result = check_project_compliance(db, project_id, "chile")
        door_checks = [c for c in result["checks"] if c["rule_id"] == "door_width"]
        assert len(door_checks) == 1
        assert door_checks[0]["severity"] == "fail"

        svc.delete_wall(wall_id)

    def test_semaphore_status_reflects_worst(self, db, project_id):
        """Overall status should be the worst finding."""
        svc = BimWallService(db)
        r = svc.draw_wall(
            project_id=project_id,
            start_x_mm=0, start_z_mm=0,
            end_x_mm=3000, end_z_mm=0,
            height_mm=2000,  # fail
        )
        wall_id = r["wall"]["id"]

        result = check_project_compliance(db, project_id, "chile")
        assert result["status"] == "fail"

        svc.delete_wall(wall_id)
