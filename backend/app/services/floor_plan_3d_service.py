"""3D extrusion service for floor plans."""

import math
from sqlalchemy.orm import Session
from app.models.floor_plan import FloorPlan, FloorPlanWall


class FloorPlan3DService:
    """Generates 3D geometry data from floor plan for Three.js rendering."""

    def __init__(self, db: Session):
        self.db = db

    def get_3d_data(self, floor_plan_id: int) -> dict:
        plan = self.db.query(FloorPlan).filter(FloorPlan.id == floor_plan_id).first()
        if not plan:
            raise ValueError(f"Floor plan {floor_plan_id} not found")

        storeys_3d = []
        for storey in plan.storeys:
            walls_3d = []
            all_x = []
            all_y = []

            for wall in storey.walls:
                # Compute wall rectangle corners from centerline + thickness
                corners = self._wall_corners(wall)
                all_x.extend([c[0] for c in corners])
                all_y.extend([c[1] for c in corners])

                # Compute wall angle for rotation
                dx = wall.end_x_mm - wall.start_x_mm
                dy = wall.end_y_mm - wall.start_y_mm
                angle = math.atan2(dy, dx)

                # Center point
                cx = (wall.start_x_mm + wall.end_x_mm) / 2
                cy = (wall.start_y_mm + wall.end_y_mm) / 2

                wall_data = {
                    "id": wall.id,
                    "label": wall.label or f"M-{wall.id}",
                    "center_x_mm": cx,
                    "center_y_mm": cy,
                    "length_mm": wall.length_mm,
                    "thickness_mm": wall.thickness_mm,
                    "height_mm": wall.effective_height_mm,
                    "angle_rad": angle,
                    "elevation_mm": storey.elevation_mm,
                    "corners": corners,
                    "openings": [
                        {
                            "type": op.opening_type,
                            "position_along_mm": op.position_along_wall_mm,
                            "y_mm": op.position_y_mm,
                            "width_mm": op.width_mm,
                            "height_mm": op.height_mm,
                        }
                        for op in wall.openings
                    ],
                }
                walls_3d.append(wall_data)

            # Floor slab (bounding rectangle)
            slab = None
            if all_x and all_y:
                margin = 100  # mm
                slab = {
                    "min_x": min(all_x) - margin,
                    "min_y": min(all_y) - margin,
                    "max_x": max(all_x) + margin,
                    "max_y": max(all_y) + margin,
                    "elevation_mm": storey.elevation_mm,
                    "thickness_mm": 200,
                }

            storeys_3d.append({
                "name": storey.name,
                "level_index": storey.level_index,
                "elevation_mm": storey.elevation_mm,
                "height_mm": storey.height_mm,
                "walls": walls_3d,
                "slab": slab,
            })

        return {"floor_plan_id": floor_plan_id, "storeys": storeys_3d}

    def _wall_corners(self, wall: FloorPlanWall) -> list[list[float]]:
        """Compute 4 corners of wall rectangle from centerline + thickness."""
        dx = wall.end_x_mm - wall.start_x_mm
        dy = wall.end_y_mm - wall.start_y_mm
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            return [[wall.start_x_mm, wall.start_y_mm]] * 4

        # Perpendicular unit vector
        px = -dy / length
        py = dx / length
        half_t = wall.thickness_mm / 2

        return [
            [wall.start_x_mm + px * half_t, wall.start_y_mm + py * half_t],
            [wall.end_x_mm + px * half_t, wall.end_y_mm + py * half_t],
            [wall.end_x_mm - px * half_t, wall.end_y_mm - py * half_t],
            [wall.start_x_mm - px * half_t, wall.start_y_mm - py * half_t],
        ]
