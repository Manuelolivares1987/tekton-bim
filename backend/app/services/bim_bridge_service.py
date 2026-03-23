"""Bridge service: converts BIM panels into IfcElement + WallOpening records."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.sip_constants import ROUGH_OPENING_CLEARANCE
from app.models.bim_panel import BimPanel
from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel
from app.models.wall_opening import WallOpening


class BimBridgeService:
    """Converts placed BIM panels into IfcElement records for panelization."""

    def __init__(self, db: Session):
        self.db = db

    def generate_elements(self, project_id: int) -> dict:
        """Generate IfcModel + IfcElement + WallOpening from placed BIM panels."""
        panels = (
            self.db.query(BimPanel)
            .filter(BimPanel.project_id == project_id)
            .order_by(BimPanel.label)
            .all()
        )

        if not panels:
            raise ValueError("No hay paneles colocados en el proyecto")

        # Delete previous bridge model
        old_models = (
            self.db.query(IfcModel)
            .filter(
                IfcModel.project_id == project_id,
                IfcModel.ifc_schema == "BimModeler",
            )
            .all()
        )
        for old in old_models:
            self.db.delete(old)
        self.db.flush()

        # Create new IfcModel
        ifc_model = IfcModel(
            project_id=project_id,
            file_name="BimModeler-Paneles",
            file_path="",
            file_size_bytes=0,
            ifc_schema="BimModeler",
            authoring_tool="Tekton BIM Modeler",
            parsed_at=datetime.now(UTC),
        )
        self.db.add(ifc_model)
        self.db.flush()

        elements_created = 0
        openings_created = 0

        for panel in panels:
            width_m = panel.width_mm / 1000
            height_m = panel.height_mm / 1000
            thickness_m = panel.thickness_mm / 1000
            gross_area = width_m * height_m

            # Subtract opening
            opening_area = 0.0
            if panel.has_opening and panel.opening_width_mm and panel.opening_height_mm:
                opening_area = (panel.opening_width_mm / 1000) * (panel.opening_height_mm / 1000)

            element = IfcElement(
                ifc_model_id=ifc_model.id,
                global_id=str(uuid.uuid4())[:22],
                ifc_type="IfcWallStandardCase",
                name=panel.label,
                description=f"Panel SIP {panel.width_mm:.0f}x{panel.height_mm:.0f}x{panel.thickness_mm:.0f}",
                storey_name=panel.storey_name,
                type_name="BIM SIP Panel",
                length_m=width_m,
                height_m=height_m,
                width_m=thickness_m,
                gross_area_m2=round(gross_area, 4),
                net_area_m2=round(gross_area - opening_area, 4),
                volume_m3=round(gross_area * thickness_m, 6),
            )
            self.db.add(element)
            self.db.flush()
            elements_created += 1

            # Link panel to element
            panel.ifc_element_id = element.id

            # Create WallOpening if panel has one
            if panel.has_opening and panel.opening_width_mm and panel.opening_height_mm:
                clearance = ROUGH_OPENING_CLEARANCE.get(panel.opening_type or "door", {"width": 25, "height": 15})
                wall_opening = WallOpening(
                    ifc_element_id=element.id,
                    opening_type=panel.opening_type or "door",
                    position_x_mm=panel.opening_x_mm or 0,
                    position_y_mm=panel.opening_y_mm or 0,
                    width_mm=panel.opening_width_mm,
                    height_mm=panel.opening_height_mm,
                    rough_opening_width_mm=panel.opening_width_mm + 2 * clearance["width"],
                    rough_opening_height_mm=panel.opening_height_mm + clearance["height"],
                )
                self.db.add(wall_opening)
                openings_created += 1

        ifc_model.element_count = elements_created
        self.db.commit()

        return {
            "ifc_model_id": ifc_model.id,
            "elements_created": elements_created,
            "openings_created": openings_created,
        }
