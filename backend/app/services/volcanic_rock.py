"""Volcanic rock (lana de roca) insulation calculation service.

Supports two calculation methods:
1. Area-based: From wall area + thickness + density
2. Panel-type-based: From predefined panel specifications
"""

from sqlalchemy.orm import Session

from app.core.formulas.insulation import (
    apply_waste_factor,
    calculate_insulation_volume,
    calculate_insulation_weight,
)
from app.models.panel import Panel
from app.services.wall_calculator import WallAreaCalculator


class VolcanicRockCalculator:
    """Calculates volcanic rock insulation quantities."""

    def __init__(self, db: Session):
        self.db = db
        self.wall_calc = WallAreaCalculator(db)

    def calculate_by_wall_area(
        self,
        wall_area_m2: float,
        thickness_mm: float = 80.0,
        density_kg_m3: float = 80.0,
        waste_factor_pct: float = 5.0,
    ) -> dict:
        """Method 1: Calculate volcanic rock from wall area and insulation parameters.

        Args:
            wall_area_m2: Total wall area in square meters
            thickness_mm: Insulation thickness in millimeters
            density_kg_m3: Volcanic rock density in kg/m3
            waste_factor_pct: Waste factor as percentage (e.g. 5.0 = 5%)

        Returns:
            dict with volume, weight, and weight with waste
        """
        volume_m3 = calculate_insulation_volume(wall_area_m2, thickness_mm)
        weight_kg = calculate_insulation_weight(volume_m3, density_kg_m3)
        weight_with_waste_kg = apply_waste_factor(weight_kg, waste_factor_pct)

        return {
            "method": "area_based",
            "area_m2": round(wall_area_m2, 3),
            "thickness_mm": thickness_mm,
            "volume_m3": round(volume_m3, 4),
            "weight_kg": round(weight_kg, 2),
            "weight_with_waste_kg": round(weight_with_waste_kg, 2),
            "density_kg_m3": density_kg_m3,
            "waste_factor_pct": waste_factor_pct,
        }

    def calculate_by_panel_type(
        self,
        panel_type_id: int,
        quantity: int,
    ) -> dict:
        """Method 2: Calculate volcanic rock from panel type specifications.

        Each panel type has a predefined volcanic_rock_kg_per_unit field.

        Args:
            panel_type_id: ID of the panel type
            quantity: Number of panel instances

        Returns:
            dict with per-unit and total weights
        """
        panel = self.db.query(Panel).filter(Panel.id == panel_type_id).first()
        if not panel:
            raise ValueError(f"Panel type with id {panel_type_id} not found")

        kg_per_unit = panel.volcanic_rock_kg_per_unit or 0.0
        total_kg = kg_per_unit * quantity

        return {
            "method": "panel_type_based",
            "panel_type_name": panel.name,
            "quantity": quantity,
            "kg_per_unit": round(kg_per_unit, 3),
            "weight_kg": round(total_kg, 2),
        }

    def calculate_from_ifc_model(
        self,
        model_id: int,
        thickness_mm: float = 80.0,
        density_kg_m3: float = 80.0,
        waste_factor_pct: float = 5.0,
    ) -> dict:
        """Calculate volcanic rock for all walls in an IFC model using Method 1.

        First computes total net wall area, then applies area-based calculation.
        """
        wall_result = self.wall_calc.calculate_total_wall_area(model_id, include_openings=True)
        total_net_area = wall_result["total_net_area_m2"]

        result = self.calculate_by_wall_area(
            wall_area_m2=total_net_area,
            thickness_mm=thickness_mm,
            density_kg_m3=density_kg_m3,
            waste_factor_pct=waste_factor_pct,
        )
        result["model_id"] = model_id
        result["wall_count"] = wall_result["wall_count"]
        return result
