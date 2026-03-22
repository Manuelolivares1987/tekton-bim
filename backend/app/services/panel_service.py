"""Panel and partition management service."""

from sqlalchemy.orm import Session

from app.models.panel import Panel
from app.models.panel_layer import PanelLayer
from app.models.material import Material
from app.core.formulas.insulation import calculate_r_value


class PanelService:
    """Manages panel/partition types with material layers."""

    def __init__(self, db: Session):
        self.db = db

    def create_panel(self, name: str, category: str, project_id: int | None = None,
                     description: str | None = None,
                     volcanic_rock_kg_per_unit: float | None = None,
                     layers: list[dict] | None = None) -> Panel:
        """Create a new panel type with optional material layers."""
        panel = Panel(
            project_id=project_id,
            name=name,
            category=category,
            description=description,
            volcanic_rock_kg_per_unit=volcanic_rock_kg_per_unit,
        )
        self.db.add(panel)
        self.db.flush()

        if layers:
            for layer_data in layers:
                layer = PanelLayer(
                    panel_id=panel.id,
                    material_id=layer_data["material_id"],
                    layer_order=layer_data["layer_order"],
                    thickness_mm=layer_data["thickness_mm"],
                    description=layer_data.get("description"),
                )
                self.db.add(layer)

        self.db.flush()
        self._recalculate_properties(panel)
        self.db.commit()
        return panel

    def update_panel(self, panel_id: int, **kwargs) -> Panel | None:
        """Update panel attributes."""
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if not panel:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(panel, key):
                setattr(panel, key, value)

        self._recalculate_properties(panel)
        self.db.commit()
        return panel

    def delete_panel(self, panel_id: int) -> bool:
        """Delete a panel type."""
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if not panel:
            return False
        self.db.delete(panel)
        self.db.commit()
        return True

    def get_panel(self, panel_id: int) -> Panel | None:
        """Get a panel with its layers."""
        return self.db.query(Panel).filter(Panel.id == panel_id).first()

    def get_all_panels(self, project_id: int | None = None) -> list[Panel]:
        """Get all panel types, optionally filtered by project."""
        query = self.db.query(Panel)
        if project_id is not None:
            query = query.filter(
                (Panel.project_id == project_id) | (Panel.project_id.is_(None))
            )
        return query.all()

    def add_layer(self, panel_id: int, material_id: int, layer_order: int,
                  thickness_mm: float, description: str | None = None) -> PanelLayer | None:
        """Add a material layer to a panel."""
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if not panel:
            return None

        layer = PanelLayer(
            panel_id=panel_id,
            material_id=material_id,
            layer_order=layer_order,
            thickness_mm=thickness_mm,
            description=description,
        )
        self.db.add(layer)
        self.db.flush()
        self._recalculate_properties(panel)
        self.db.commit()
        return layer

    def update_layer(self, layer_id: int, **kwargs) -> PanelLayer | None:
        """Update a panel layer."""
        layer = self.db.query(PanelLayer).filter(PanelLayer.id == layer_id).first()
        if not layer:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(layer, key):
                setattr(layer, key, value)

        self.db.flush()
        panel = self.db.query(Panel).filter(Panel.id == layer.panel_id).first()
        if panel:
            self._recalculate_properties(panel)
        self.db.commit()
        return layer

    def delete_layer(self, layer_id: int) -> bool:
        """Remove a layer from a panel."""
        layer = self.db.query(PanelLayer).filter(PanelLayer.id == layer_id).first()
        if not layer:
            return False
        panel_id = layer.panel_id
        self.db.delete(layer)
        self.db.flush()
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if panel:
            self._recalculate_properties(panel)
        self.db.commit()
        return True

    def reorder_layers(self, panel_id: int, layer_ids: list[int]) -> bool:
        """Reorder layers by setting their layer_order based on list position."""
        for order, layer_id in enumerate(layer_ids, start=1):
            layer = self.db.query(PanelLayer).filter(
                PanelLayer.id == layer_id, PanelLayer.panel_id == panel_id
            ).first()
            if layer:
                layer.layer_order = order
        self.db.commit()
        return True

    def _recalculate_properties(self, panel: Panel):
        """Recalculate total thickness, weight/m2, and R-value from layers."""
        layers = (
            self.db.query(PanelLayer)
            .filter(PanelLayer.panel_id == panel.id)
            .order_by(PanelLayer.layer_order)
            .all()
        )

        total_thickness = 0.0
        total_weight_per_m2 = 0.0
        total_r_value = 0.0

        for layer in layers:
            material = self.db.query(Material).filter(Material.id == layer.material_id).first()
            if not material:
                continue

            total_thickness += layer.thickness_mm

            # Weight per m2 = density * thickness(m)
            if material.density_kg_m3:
                total_weight_per_m2 += material.density_kg_m3 * (layer.thickness_mm / 1000.0)

            # R-value
            if material.thermal_conductivity_w_mk and material.thermal_conductivity_w_mk > 0:
                total_r_value += calculate_r_value(layer.thickness_mm, material.thermal_conductivity_w_mk)

        panel.total_thickness_mm = round(total_thickness, 2)
        panel.total_weight_per_m2_kg = round(total_weight_per_m2, 3)
        panel.r_value_m2k_w = round(total_r_value, 4)
