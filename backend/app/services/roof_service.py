"""Roof service — geometry computation and 3D data for roof/techumbre.

Generates roof planes, ridge line, and basic structural geometry
from roof parameters and wall bounding box.
"""


from sqlalchemy.orm import Session

from app.models.bim_roof import BimRoof
from app.models.bim_wall import BimWall


class RoofService:
    def __init__(self, db: Session):
        self.db = db

    def create_roof_from_walls(self, project_id: int, roof_type: str = "gable",
                                pitch_deg: float = 25.0, overhang_mm: float = 400.0) -> dict:
        """Create a roof that covers all walls in the project."""
        walls = self.db.query(BimWall).filter(BimWall.project_id == project_id).all()
        if not walls:
            raise ValueError("No walls in project")

        # Compute bounding box from all wall endpoints
        all_x = []
        all_z = []
        max_height = 0.0
        for w in walls:
            all_x.extend([w.start_x_mm, w.end_x_mm])
            all_z.extend([w.start_z_mm, w.end_z_mm])
            max_height = max(max_height, w.height_mm)

        min_x = min(all_x) - overhang_mm
        max_x = max(all_x) + overhang_mm
        min_z = min(all_z) - overhang_mm
        max_z = max(all_z) + overhang_mm

        # Ridge along the longer axis
        dx = max(all_x) - min(all_x)
        dz = max(all_z) - min(all_z)
        ridge_orient = 0.0 if dx >= dz else 90.0

        # Auto-label
        count = self.db.query(BimRoof).filter(BimRoof.project_id == project_id).count()
        label = f"R-{count + 1:03d}"

        roof = BimRoof(
            project_id=project_id,
            label=label,
            roof_type=roof_type,
            pitch_deg=pitch_deg,
            overhang_mm=overhang_mm,
            ridge_orientation_deg=ridge_orient,
            min_x_mm=min_x,
            min_z_mm=min_z,
            max_x_mm=max_x,
            max_z_mm=max_z,
            base_elevation_mm=max_height,
        )
        roof.compute_ridge_height()
        self.db.add(roof)
        self.db.commit()
        self.db.refresh(roof)

        return self.get_roof_geometry(roof.id)

    def get_roof_geometry(self, roof_id: int) -> dict:
        """Get 3D geometry data for a roof."""
        roof = self.db.query(BimRoof).filter(BimRoof.id == roof_id).first()
        if not roof:
            raise ValueError("Roof not found")

        if roof.roof_type == "gable":
            return self._gable_geometry(roof)
        elif roof.roof_type == "shed":
            return self._shed_geometry(roof)
        elif roof.roof_type == "hip":
            return self._hip_geometry(roof)
        else:
            return self._flat_geometry(roof)

    def list_roofs(self, project_id: int) -> list[dict]:
        roofs = self.db.query(BimRoof).filter(BimRoof.project_id == project_id).all()
        return [self._roof_to_dict(r) for r in roofs]

    def delete_roof(self, roof_id: int):
        roof = self.db.query(BimRoof).filter(BimRoof.id == roof_id).first()
        if roof:
            self.db.delete(roof)
            self.db.commit()

    # ── Geometry generators ──

    def _gable_geometry(self, roof: BimRoof) -> dict:
        """Two-slope gable roof (2 aguas)."""
        base_y = roof.base_elevation_mm
        ridge_y = base_y + (roof.ridge_height_mm or 0)
        planes = []

        if roof.ridge_orientation_deg == 0:
            # Ridge along X axis
            mid_z = (roof.min_z_mm + roof.max_z_mm) / 2

            # Left slope (min_z side)
            planes.append({
                "name": "agua_1",
                "vertices": [
                    [roof.min_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, ridge_y, mid_z],
                    [roof.min_x_mm, ridge_y, mid_z],
                ],
            })
            # Right slope (max_z side)
            planes.append({
                "name": "agua_2",
                "vertices": [
                    [roof.min_x_mm, ridge_y, mid_z],
                    [roof.max_x_mm, ridge_y, mid_z],
                    [roof.max_x_mm, base_y, roof.max_z_mm],
                    [roof.min_x_mm, base_y, roof.max_z_mm],
                ],
            })
        else:
            # Ridge along Z axis
            mid_x = (roof.min_x_mm + roof.max_x_mm) / 2
            planes.append({
                "name": "agua_1",
                "vertices": [
                    [roof.min_x_mm, base_y, roof.min_z_mm],
                    [mid_x, ridge_y, roof.min_z_mm],
                    [mid_x, ridge_y, roof.max_z_mm],
                    [roof.min_x_mm, base_y, roof.max_z_mm],
                ],
            })
            planes.append({
                "name": "agua_2",
                "vertices": [
                    [mid_x, ridge_y, roof.min_z_mm],
                    [roof.max_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, base_y, roof.max_z_mm],
                    [mid_x, ridge_y, roof.max_z_mm],
                ],
            })

        ridge_line = self._get_ridge_line(roof, ridge_y)

        return {
            "roof": self._roof_to_dict(roof),
            "planes": planes,
            "ridge_line": ridge_line,
            "eave_height_mm": base_y,
            "ridge_height_mm": ridge_y,
        }

    def _shed_geometry(self, roof: BimRoof) -> dict:
        """Single-slope shed roof (1 agua)."""
        base_y = roof.base_elevation_mm
        high_y = base_y + (roof.ridge_height_mm or 0)

        if roof.ridge_orientation_deg == 0:
            planes = [{
                "name": "agua_unica",
                "vertices": [
                    [roof.min_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, high_y, roof.max_z_mm],
                    [roof.min_x_mm, high_y, roof.max_z_mm],
                ],
            }]
        else:
            planes = [{
                "name": "agua_unica",
                "vertices": [
                    [roof.min_x_mm, base_y, roof.min_z_mm],
                    [roof.max_x_mm, high_y, roof.min_z_mm],
                    [roof.max_x_mm, high_y, roof.max_z_mm],
                    [roof.min_x_mm, base_y, roof.max_z_mm],
                ],
            }]

        return {
            "roof": self._roof_to_dict(roof),
            "planes": planes,
            "ridge_line": None,
            "eave_height_mm": base_y,
            "ridge_height_mm": high_y,
        }

    def _hip_geometry(self, roof: BimRoof) -> dict:
        """Four-slope hip roof (4 aguas)."""
        base_y = roof.base_elevation_mm
        ridge_y = base_y + (roof.ridge_height_mm or 0)
        mid_x = (roof.min_x_mm + roof.max_x_mm) / 2
        mid_z = (roof.min_z_mm + roof.max_z_mm) / 2

        # Inset ridge endpoints
        dx = roof.max_x_mm - roof.min_x_mm
        dz = roof.max_z_mm - roof.min_z_mm
        inset = min(dx, dz) / 2

        if roof.ridge_orientation_deg == 0:
            r1 = [roof.min_x_mm + inset, ridge_y, mid_z]
            r2 = [roof.max_x_mm - inset, ridge_y, mid_z]
        else:
            r1 = [mid_x, ridge_y, roof.min_z_mm + inset]
            r2 = [mid_x, ridge_y, roof.max_z_mm - inset]

        planes = [
            {"name": "agua_frente", "vertices": [
                [roof.min_x_mm, base_y, roof.min_z_mm],
                [roof.max_x_mm, base_y, roof.min_z_mm],
                r2, r1,
            ]},
            {"name": "agua_atras", "vertices": [
                [roof.min_x_mm, base_y, roof.max_z_mm],
                r1, r2,
                [roof.max_x_mm, base_y, roof.max_z_mm],
            ]},
            {"name": "agua_izq", "vertices": [
                [roof.min_x_mm, base_y, roof.min_z_mm],
                r1,
                [roof.min_x_mm, base_y, roof.max_z_mm],
            ]},
            {"name": "agua_der", "vertices": [
                [roof.max_x_mm, base_y, roof.min_z_mm],
                [roof.max_x_mm, base_y, roof.max_z_mm],
                r2,
            ]},
        ]

        return {
            "roof": self._roof_to_dict(roof),
            "planes": planes,
            "ridge_line": [r1, r2],
            "eave_height_mm": base_y,
            "ridge_height_mm": ridge_y,
        }

    def _flat_geometry(self, roof: BimRoof) -> dict:
        """Flat roof with minimal slope for drainage."""
        base_y = roof.base_elevation_mm
        planes = [{
            "name": "plano",
            "vertices": [
                [roof.min_x_mm, base_y, roof.min_z_mm],
                [roof.max_x_mm, base_y, roof.min_z_mm],
                [roof.max_x_mm, base_y, roof.max_z_mm],
                [roof.min_x_mm, base_y, roof.max_z_mm],
            ],
        }]
        return {
            "roof": self._roof_to_dict(roof),
            "planes": planes,
            "ridge_line": None,
            "eave_height_mm": base_y,
            "ridge_height_mm": base_y,
        }

    def _get_ridge_line(self, roof: BimRoof, ridge_y: float) -> list:
        if roof.ridge_orientation_deg == 0:
            mid_z = (roof.min_z_mm + roof.max_z_mm) / 2
            return [[roof.min_x_mm, ridge_y, mid_z], [roof.max_x_mm, ridge_y, mid_z]]
        mid_x = (roof.min_x_mm + roof.max_x_mm) / 2
        return [[mid_x, ridge_y, roof.min_z_mm], [mid_x, ridge_y, roof.max_z_mm]]

    def _roof_to_dict(self, r: BimRoof) -> dict:
        return {
            "id": r.id,
            "project_id": r.project_id,
            "label": r.label,
            "roof_type": r.roof_type,
            "pitch_deg": r.pitch_deg,
            "overhang_mm": r.overhang_mm,
            "ridge_height_mm": r.ridge_height_mm,
            "ridge_orientation_deg": r.ridge_orientation_deg,
            "base_elevation_mm": r.base_elevation_mm,
            "span_mm": r.span_mm,
            "ridge_length_mm": r.ridge_length_mm,
            "min_x_mm": r.min_x_mm,
            "max_x_mm": r.max_x_mm,
            "min_z_mm": r.min_z_mm,
            "max_z_mm": r.max_z_mm,
        }
