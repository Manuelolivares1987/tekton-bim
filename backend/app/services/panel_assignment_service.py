"""Panel assignment service - assigns numbered SIP panels to IFC wall elements."""

from sqlalchemy.orm import Session

from app.models.ifc_element import IfcElement
from app.models.panel import Panel
from app.models.panel_assignment import PanelAssignment

# Prefix mapping for panel categories
CATEGORY_PREFIX = {
    "exterior_wall": "EXT",
    "interior_wall": "INT",
    "partition": "PAR",
    "floor": "FLR",
    "roof": "ROF",
}


class PanelAssignmentService:
    """Manages assignment of numbered panels to IFC elements."""

    def __init__(self, db: Session):
        self.db = db

    def _get_next_panel_number(self, project_id: int, category: str) -> str:
        """Generate next panel number for a category in a project."""
        prefix = CATEGORY_PREFIX.get(category, "PNL")

        # Find max existing number for this prefix
        existing = (
            self.db.query(PanelAssignment.panel_number)
            .filter(
                PanelAssignment.project_id == project_id,
                PanelAssignment.panel_number.like(f"{prefix}-%"),
            )
            .all()
        )

        max_num = 0
        for (num_str,) in existing:
            try:
                num = int(num_str.split("-")[1])
                if num > max_num:
                    max_num = num
            except (IndexError, ValueError):
                continue

        return f"{prefix}-{max_num + 1:03d}"

    def create_assignment(
        self,
        project_id: int,
        ifc_element_id: int,
        panel_id: int,
        notes: str | None = None,
    ) -> PanelAssignment:
        """Create a single panel assignment with auto-numbering."""
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if not panel:
            raise ValueError(f"Panel {panel_id} not found")

        element = self.db.query(IfcElement).filter(IfcElement.id == ifc_element_id).first()
        if not element:
            raise ValueError(f"IFC Element {ifc_element_id} not found")

        panel_number = self._get_next_panel_number(project_id, panel.category)

        assignment = PanelAssignment(
            project_id=project_id,
            ifc_element_id=ifc_element_id,
            panel_id=panel_id,
            panel_number=panel_number,
            notes=notes,
        )
        self.db.add(assignment)
        self.db.commit()
        return assignment

    def bulk_assign(
        self,
        project_id: int,
        ifc_element_ids: list[int],
        panel_id: int,
        notes: str | None = None,
    ) -> list[PanelAssignment]:
        """Assign panel type to multiple elements at once."""
        panel = self.db.query(Panel).filter(Panel.id == panel_id).first()
        if not panel:
            raise ValueError(f"Panel {panel_id} not found")

        assignments = []
        for element_id in ifc_element_ids:
            # Skip if already assigned
            existing = (
                self.db.query(PanelAssignment)
                .filter(
                    PanelAssignment.project_id == project_id,
                    PanelAssignment.ifc_element_id == element_id,
                )
                .first()
            )
            if existing:
                continue

            panel_number = self._get_next_panel_number(project_id, panel.category)
            assignment = PanelAssignment(
                project_id=project_id,
                ifc_element_id=element_id,
                panel_id=panel_id,
                panel_number=panel_number,
                notes=notes,
            )
            self.db.add(assignment)
            self.db.flush()  # So next iteration sees this assignment
            assignments.append(assignment)

        self.db.commit()
        return assignments

    def get_assignment(self, assignment_id: int) -> PanelAssignment | None:
        return self.db.query(PanelAssignment).filter(PanelAssignment.id == assignment_id).first()

    def get_assignments(self, project_id: int) -> list[dict]:
        """Get all assignments with element and panel details."""
        assignments = (
            self.db.query(PanelAssignment)
            .filter(PanelAssignment.project_id == project_id)
            .order_by(PanelAssignment.panel_number)
            .all()
        )

        results = []
        for a in assignments:
            element = self.db.query(IfcElement).filter(IfcElement.id == a.ifc_element_id).first()
            panel = self.db.query(Panel).filter(Panel.id == a.panel_id).first()
            results.append({
                "id": a.id,
                "project_id": a.project_id,
                "ifc_element_id": a.ifc_element_id,
                "panel_id": a.panel_id,
                "panel_number": a.panel_number,
                "notes": a.notes,
                "element_name": element.name if element else None,
                "element_global_id": element.global_id if element else "",
                "element_ifc_type": element.ifc_type if element else "",
                "element_storey": element.storey_name if element else None,
                "element_gross_area_m2": element.gross_area_m2 if element else None,
                "panel_name": panel.name if panel else "",
                "panel_category": panel.category if panel else "",
                "created_at": a.created_at,
                "updated_at": a.updated_at,
            })
        return results

    def update_assignment(self, assignment_id: int, **kwargs) -> PanelAssignment | None:
        assignment = self.db.query(PanelAssignment).filter(PanelAssignment.id == assignment_id).first()
        if not assignment:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(assignment, key):
                setattr(assignment, key, value)

        self.db.commit()
        return assignment

    def delete_assignment(self, assignment_id: int) -> bool:
        assignment = self.db.query(PanelAssignment).filter(PanelAssignment.id == assignment_id).first()
        if not assignment:
            return False
        self.db.delete(assignment)
        self.db.commit()
        return True
