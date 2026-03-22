"""Plumbing system design service (IPC/UPC-based)."""

from sqlalchemy.orm import Session

from app.models.mep_plumbing_fixture import MepPlumbingFixture
from app.models.mep_pipe_segment import MepPipeSegment
from app.core.formulas.plumbing import (
    get_fixture_units,
    get_drain_size,
    fixture_units_to_gpm,
    size_pipe,
    calculate_system_pressure,
    FIXTURE_UNITS,
)


class PlumbingDesignService:
    """Plumbing system design with IPC/UPC-compliant calculations."""

    def __init__(self, db: Session):
        self.db = db

    def get_available_fixture_types(self) -> list[dict]:
        """Return all available fixture types with their properties."""
        return [
            {"type": k, "fixture_units": v["fu"], "drain_size_mm": v["drain_mm"]}
            for k, v in FIXTURE_UNITS.items()
        ]

    def add_fixture(
        self,
        project_id: int,
        fixture_type: str,
        hot_water: bool = False,
        cold_water: bool = True,
        location_x: float | None = None,
        location_y: float | None = None,
        location_z: float | None = None,
        storey_name: str | None = None,
    ) -> MepPlumbingFixture:
        """Add a plumbing fixture to the project."""
        fu = get_fixture_units(fixture_type)
        drain = get_drain_size(fixture_type)

        fixture = MepPlumbingFixture(
            project_id=project_id,
            fixture_type=fixture_type,
            fixture_units=fu,
            hot_water=hot_water,
            cold_water=cold_water,
            drain_size_mm=drain,
            location_x=location_x,
            location_y=location_y,
            location_z=location_z,
            storey_name=storey_name,
        )
        self.db.add(fixture)
        self.db.commit()
        self.db.refresh(fixture)
        return fixture

    def calculate_total_fixture_units(self, project_id: int) -> dict:
        """Calculate total fixture units for a project."""
        fixtures = (
            self.db.query(MepPlumbingFixture)
            .filter(MepPlumbingFixture.project_id == project_id)
            .all()
        )

        total_fu = sum(f.fixture_units for f in fixtures)
        total_gpm = fixture_units_to_gpm(total_fu)

        # Group by type
        by_type: dict[str, dict] = {}
        for f in fixtures:
            if f.fixture_type not in by_type:
                by_type[f.fixture_type] = {"count": 0, "total_fu": 0}
            by_type[f.fixture_type]["count"] += 1
            by_type[f.fixture_type]["total_fu"] += f.fixture_units

        return {
            "project_id": project_id,
            "fixture_count": len(fixtures),
            "total_fixture_units": round(total_fu, 1),
            "estimated_demand_gpm": round(total_gpm, 1),
            "by_type": by_type,
        }

    def size_supply_pipe(
        self,
        flow_gpm: float,
        velocity_target_fps: float = 5.0,
        pipe_material: str = "copper",
    ) -> dict:
        """Size supply pipe for a given flow rate."""
        nominal, diameter, velocity = size_pipe(flow_gpm, velocity_target_fps, pipe_material)

        return {
            "nominal_size": nominal,
            "diameter_inches": round(diameter, 3),
            "diameter_mm": round(diameter * 25.4, 1),
            "actual_velocity_fps": round(velocity, 2),
            "flow_gpm": flow_gpm,
        }

    def calculate_pressure(
        self,
        supply_pressure_psi: float,
        elevation_ft: float,
        total_pipe_length_ft: float,
        total_fixture_units: float,
        pipe_material: str = "copper",
        pipe_diameter_inches: float = 0.75,
    ) -> dict:
        """Calculate system pressure at most remote fixture."""
        flow_gpm = fixture_units_to_gpm(total_fixture_units)

        result = calculate_system_pressure(
            supply_pressure_psi=supply_pressure_psi,
            elevation_ft=elevation_ft,
            pipe_length_ft=total_pipe_length_ft,
            flow_gpm=flow_gpm,
            internal_diameter_inches=pipe_diameter_inches,
            pipe_material=pipe_material,
        )
        result["flow_gpm"] = round(flow_gpm, 1)
        result["total_fixture_units"] = total_fixture_units
        return result

    def get_project_fixtures(self, project_id: int) -> list[MepPlumbingFixture]:
        """Get all fixtures for a project."""
        return (
            self.db.query(MepPlumbingFixture)
            .filter(MepPlumbingFixture.project_id == project_id)
            .all()
        )
