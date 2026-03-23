"""Assembly plan service - generates panel schedules, material BOMs, and summaries."""

from sqlalchemy.orm import Session

from app.models.ifc_element import IfcElement
from app.models.material import Material
from app.models.panel import Panel
from app.models.panel_assignment import PanelAssignment
from app.models.panel_layer import PanelLayer


class AssemblyPlanService:
    """Generates assembly plan data from panel assignments."""

    def __init__(self, db: Session):
        self.db = db

    def generate_panel_schedule(self, project_id: int) -> dict:
        """Generate ordered panel schedule with element details and production data."""
        assignments = (
            self.db.query(PanelAssignment)
            .filter(PanelAssignment.project_id == project_id)
            .order_by(PanelAssignment.panel_number)
            .all()
        )

        items = []
        for a in assignments:
            element = self.db.query(IfcElement).filter(IfcElement.id == a.ifc_element_id).first()
            panel = self.db.query(Panel).filter(Panel.id == a.panel_id).first()

            # Get element dimensions for production
            width_m = element.length_m if element else None
            height_m = element.height_m if element else None
            thickness_mm = panel.total_thickness_mm if panel else None
            weight_per_m2 = panel.total_weight_per_m2_kg if panel else None
            area = element.gross_area_m2 if element else None
            total_weight = round(area * weight_per_m2, 2) if area and weight_per_m2 else None

            items.append({
                "panel_number": a.panel_number,
                "panel_name": panel.name if panel else "",
                "panel_category": panel.category if panel else "",
                "element_name": element.name if element else None,
                "element_ifc_type": element.ifc_type if element else "",
                "storey": element.storey_name if element else None,
                "width_m": round(width_m, 3) if width_m else None,
                "height_m": round(height_m, 3) if height_m else None,
                "thickness_mm": round(thickness_mm, 1) if thickness_mm else None,
                "area_m2": round(area, 2) if area else None,
                "weight_kg": total_weight,
                "notes": a.notes,
            })

        return {
            "project_id": project_id,
            "items": items,
            "total_panels": len(items),
        }

    def generate_material_bom(self, project_id: int, waste_factor: float = 1.1) -> dict:
        """Generate material Bill of Materials from all panel assignments.

        For each assignment:
          element_area = ifc_element.gross_area_m2
          For each panel layer:
            volume = element_area * (layer.thickness_mm / 1000)
            weight = volume * material.density_kg_m3
          Aggregate by material across all assignments
        Apply waste_factor
        Calculate cost = quantity * material.cost_per_unit
        """
        assignments = (
            self.db.query(PanelAssignment)
            .filter(PanelAssignment.project_id == project_id)
            .all()
        )

        # Accumulate materials: {material_id: {"weight_kg": float, ...}}
        material_totals: dict[int, float] = {}

        for a in assignments:
            element = self.db.query(IfcElement).filter(IfcElement.id == a.ifc_element_id).first()
            if not element or not element.gross_area_m2:
                continue

            panel = self.db.query(Panel).filter(Panel.id == a.panel_id).first()
            if not panel:
                continue

            layers = (
                self.db.query(PanelLayer)
                .filter(PanelLayer.panel_id == panel.id)
                .order_by(PanelLayer.layer_order)
                .all()
            )

            for layer in layers:
                volume_m3 = element.gross_area_m2 * (layer.thickness_mm / 1000.0)
                material = self.db.query(Material).filter(Material.id == layer.material_id).first()
                if not material or not material.density_kg_m3:
                    continue

                weight_kg = volume_m3 * material.density_kg_m3
                material_totals[layer.material_id] = material_totals.get(layer.material_id, 0.0) + weight_kg

        # Build BOM items
        items = []
        total_cost = 0.0

        for material_id, weight_kg in sorted(material_totals.items()):
            material = self.db.query(Material).filter(Material.id == material_id).first()
            if not material:
                continue

            quantity = weight_kg * waste_factor
            cost = quantity * material.cost_per_unit if material.cost_per_unit else None

            items.append({
                "material_name": material.name,
                "category": material.category,
                "quantity": round(quantity, 2),
                "unit": material.cost_unit or "kg",
                "cost_per_unit": material.cost_per_unit,
                "total_cost": round(cost, 2) if cost else None,
            })

            if cost:
                total_cost += cost

        return {
            "project_id": project_id,
            "items": items,
            "waste_factor": waste_factor,
            "total_cost": round(total_cost, 2),
        }

    def generate_assembly_summary(self, project_id: int) -> dict:
        """Generate summary statistics for all assignments."""
        assignments = (
            self.db.query(PanelAssignment)
            .filter(PanelAssignment.project_id == project_id)
            .all()
        )

        total_area = 0.0
        by_panel_type: dict[str, int] = {}
        by_storey: dict[str, int] = {}

        for a in assignments:
            element = self.db.query(IfcElement).filter(IfcElement.id == a.ifc_element_id).first()
            panel = self.db.query(Panel).filter(Panel.id == a.panel_id).first()

            if element and element.gross_area_m2:
                total_area += element.gross_area_m2

            storey = element.storey_name if element else "Unknown"
            by_storey[storey] = by_storey.get(storey, 0) + 1

            panel_name = panel.name if panel else "Unknown"
            by_panel_type[panel_name] = by_panel_type.get(panel_name, 0) + 1

        # Get total material cost
        bom = self.generate_material_bom(project_id)

        return {
            "project_id": project_id,
            "total_panels": len(assignments),
            "total_area_m2": round(total_area, 2),
            "by_panel_type": by_panel_type,
            "by_storey": by_storey,
            "total_material_cost": bom["total_cost"],
        }
