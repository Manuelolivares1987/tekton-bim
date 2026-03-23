"""Panel assignment API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.panel_assignment import (
    BulkAssignmentCreate,
    PanelAssignmentCreate,
    PanelAssignmentResponse,
    PanelAssignmentUpdate,
    PanelAssignmentWithDetails,
)
from app.services.panel_assignment_service import PanelAssignmentService

router = APIRouter()


@router.post("/", response_model=PanelAssignmentResponse)
def create_assignment(data: PanelAssignmentCreate, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    try:
        assignment = service.create_assignment(
            project_id=data.project_id,
            ifc_element_id=data.ifc_element_id,
            panel_id=data.panel_id,
            notes=data.notes,
        )
        return assignment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bulk", response_model=list[PanelAssignmentResponse])
def bulk_assign(data: BulkAssignmentCreate, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    try:
        assignments = service.bulk_assign(
            project_id=data.project_id,
            ifc_element_ids=data.ifc_element_ids,
            panel_id=data.panel_id,
            notes=data.notes,
        )
        return assignments
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/", response_model=list[PanelAssignmentWithDetails])
def list_assignments(project_id: int, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    return service.get_assignments(project_id)


@router.get("/{assignment_id}", response_model=PanelAssignmentResponse)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    assignment = service.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.put("/{assignment_id}", response_model=PanelAssignmentResponse)
def update_assignment(assignment_id: int, data: PanelAssignmentUpdate, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    assignment = service.update_assignment(
        assignment_id,
        panel_id=data.panel_id,
        panel_number=data.panel_number,
        notes=data.notes,
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    service = PanelAssignmentService(db)
    if not service.delete_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"status": "deleted"}
