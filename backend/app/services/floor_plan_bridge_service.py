"""Bridge service: converts floor plan data into IfcElement + WallOpening records.

This is the critical integration point that makes the existing panelization
engine work with floor plan data without any modifications.
"""

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.floor_plan import FloorPlan, FloorPlanStorey, FloorPlanWall, FloorPlanOpening
from app.models.ifc_model import IfcModel
from app.models.ifc_element import IfcElement
from app.models.wall_opening import WallOpening
from app.core.sip_constants import ROUGH_OPENING_CLEARANCE


class FloorPlanBridgeService:
    """Converts floor plan walls/openings into IfcElement/WallOpening records."""

    def __init__(self, db: Session):
        self.db = db

    def generate_elements(self, floor_plan_id: int) -> dict:
        """
        Generate IfcModel, IfcElement, and WallOpening records from a floor plan.

        Returns dict with model_id, elements_created, openings_created.
        """
        plan = self.db.query(FloorPlan).filter(FloorPlan.id == floor_plan_id).first()
        if not plan:
            raise ValueError(f"Floor plan {floor_plan_id} not found")

        # Delete previously generated model if exists
        if plan.ifc_model_id:
            old_model = self.db.query(IfcModel).filter(IfcModel.id == plan.ifc_model_id).first()
            if old_model:
                # Cascade deletes elements and their openings
                self.db.delete(old_model)
                self.db.flush()

        # Create new IfcModel
        ifc_model = IfcModel(
            project_id=plan.project_id,
            file_name=f"FloorPlan-{plan.name}",
            file_path="",
            file_size_bytes=0,
            ifc_schema="FloorPlan",
            authoring_tool="Tekton Floor Plan Editor",
            parsed_at=datetime.utcnow(),
        )
        self.db.add(ifc_model)
        self.db.flush()

        elements_created = 0
        openings_created = 0
        wall_counter = 0

        for storey in plan.storeys:
            for wall in storey.walls:
                wall_counter += 1
                wall_length_m = wall.length_mm / 1000
                wall_height_m = wall.effective_height_mm / 1000
                wall_width_m = wall.thickness_mm / 1000

                if wall_length_m <= 0 or wall_height_m <= 0:
                    continue

                gross_area = wall_length_m * wall_height_m

                # Calculate net area (subtract openings)
                opening_area = 0.0
                for op in wall.openings:
                    opening_area += (op.width_mm / 1000) * (op.height_mm / 1000)
                net_area = gross_area - opening_area

                # Create IfcElement
                element = IfcElement(
                    ifc_model_id=ifc_model.id,
                    global_id=str(uuid.uuid4())[:22],
                    ifc_type="IfcWallStandardCase",
                    name=wall.label or f"M-{wall_counter:03d}",
                    description=f"Muro generado desde plano de planta",
                    storey_name=storey.name,
                    type_name="FloorPlan Wall",
                    length_m=wall_length_m,
                    height_m=wall_height_m,
                    width_m=wall_width_m,
                    gross_area_m2=round(gross_area, 4),
                    net_area_m2=round(net_area, 4),
                    volume_m3=round(gross_area * wall_width_m, 4),
                )
                self.db.add(element)
                self.db.flush()
                elements_created += 1

                # Link wall to generated element
                wall.ifc_element_id = element.id

                # Create WallOpening records
                for op in wall.openings:
                    clearance = ROUGH_OPENING_CLEARANCE.get(op.opening_type, {"width": 25, "height": 15})

                    wall_opening = WallOpening(
                        ifc_element_id=element.id,
                        opening_type=op.opening_type,
                        position_x_mm=op.position_along_wall_mm,
                        position_y_mm=op.position_y_mm,
                        width_mm=op.width_mm,
                        height_mm=op.height_mm,
                        rough_opening_width_mm=op.width_mm + 2 * clearance["width"],
                        rough_opening_height_mm=op.height_mm + clearance["height"],
                    )
                    self.db.add(wall_opening)
                    openings_created += 1

        # Update model element count and plan reference
        ifc_model.element_count = elements_created
        plan.ifc_model_id = ifc_model.id

        self.db.commit()

        return {
            "ifc_model_id": ifc_model.id,
            "elements_created": elements_created,
            "openings_created": openings_created,
        }
