"""Wall area calculation service."""

from sqlalchemy.orm import Session

from app.models.ifc_element import IfcElement


class WallAreaCalculator:
    """Calculates wall areas from parsed IFC elements."""

    WALL_TYPES = ("IfcWall", "IfcWallStandardCase")

    def __init__(self, db: Session):
        self.db = db

    def _get_walls(self, model_id: int) -> list[IfcElement]:
        """Get all wall elements for a model."""
        return (
            self.db.query(IfcElement)
            .filter(
                IfcElement.ifc_model_id == model_id,
                IfcElement.ifc_type.in_(self.WALL_TYPES),
            )
            .all()
        )

    def calculate_total_wall_area(self, model_id: int, include_openings: bool = True) -> dict:
        """Calculate total wall area in m2.

        Returns:
            dict with total_gross_area_m2, total_net_area_m2, by_storey, by_type, wall_count
        """
        walls = self._get_walls(model_id)

        total_gross = 0.0
        total_net = 0.0
        by_storey: dict[str, float] = {}
        by_type: dict[str, float] = {}

        for wall in walls:
            gross = wall.gross_area_m2 or 0.0
            net = wall.net_area_m2 or gross  # Fallback to gross if net not available

            total_gross += gross
            if include_openings:
                total_net += net
            else:
                total_net += gross

            # Group by storey
            storey = wall.storey_name or "Unknown"
            by_storey[storey] = by_storey.get(storey, 0.0) + (net if include_openings else gross)

            # Group by type
            type_name = wall.type_name or "Unnamed Wall"
            by_type[type_name] = by_type.get(type_name, 0.0) + (net if include_openings else gross)

        return {
            "model_id": model_id,
            "total_gross_area_m2": round(total_gross, 3),
            "total_net_area_m2": round(total_net, 3),
            "by_storey": {k: round(v, 3) for k, v in sorted(by_storey.items())},
            "by_type": {k: round(v, 3) for k, v in sorted(by_type.items())},
            "wall_count": len(walls),
        }

    def get_wall_schedule(self, model_id: int) -> list[dict]:
        """Get detailed wall-by-wall schedule."""
        walls = self._get_walls(model_id)

        schedule = []
        for wall in walls:
            schedule.append({
                "global_id": wall.global_id,
                "name": wall.name or "Unnamed",
                "type_name": wall.type_name or "Unnamed",
                "storey": wall.storey_name or "Unknown",
                "length_m": round(wall.length_m, 3) if wall.length_m else None,
                "height_m": round(wall.height_m, 3) if wall.height_m else None,
                "width_m": round(wall.width_m, 3) if wall.width_m else None,
                "gross_area_m2": round(wall.gross_area_m2, 3) if wall.gross_area_m2 else None,
                "net_area_m2": round(wall.net_area_m2, 3) if wall.net_area_m2 else None,
                "volume_m3": round(wall.volume_m3, 3) if wall.volume_m3 else None,
            })

        return schedule
