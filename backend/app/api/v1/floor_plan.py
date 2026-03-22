"""Floor plan editor API endpoints."""

import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.floor_plan import FloorPlan, FloorPlanStorey, FloorPlanWall, FloorPlanOpening
from app.services.floor_plan_bridge_service import FloorPlanBridgeService
from app.services.floor_plan_3d_service import FloorPlan3DService
from app.schemas.floor_plan import (
    FloorPlanCreate, FloorPlanUpdate, FloorPlanResponse,
    FloorPlanStoreyCreate, FloorPlanStoreyResponse,
    FloorPlanWallCreate, FloorPlanWallUpdate, FloorPlanWallResponse,
    FloorPlanOpeningCreate, FloorPlanOpeningResponse,
    BulkSaveRequest,
)

router = APIRouter()


# --- Floor Plans ---

@router.post("/", response_model=FloorPlanResponse)
def create_floor_plan(data: FloorPlanCreate, db: Session = Depends(get_db)):
    plan = FloorPlan(**data.model_dump())
    db.add(plan)
    db.flush()

    # Auto-create first storey
    storey = FloorPlanStorey(
        floor_plan_id=plan.id,
        name="Piso 1",
        level_index=0,
        elevation_mm=0.0,
        height_mm=data.default_wall_height_mm,
    )
    db.add(storey)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/", response_model=list[FloorPlanResponse])
def list_floor_plans(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FloorPlan)
        .filter(FloorPlan.project_id == project_id)
        .order_by(FloorPlan.updated_at.desc())
        .all()
    )


@router.get("/{plan_id}", response_model=FloorPlanResponse)
def get_floor_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FloorPlan).filter(FloorPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    return plan


@router.put("/{plan_id}", response_model=FloorPlanResponse)
def update_floor_plan(plan_id: int, data: FloorPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(FloorPlan).filter(FloorPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def delete_floor_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FloorPlan).filter(FloorPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    db.delete(plan)
    db.commit()
    return {"detail": "Floor plan deleted"}


# --- Storeys ---

@router.post("/{plan_id}/storeys", response_model=FloorPlanStoreyResponse)
def add_storey(plan_id: int, data: FloorPlanStoreyCreate, db: Session = Depends(get_db)):
    plan = db.query(FloorPlan).filter(FloorPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    storey = FloorPlanStorey(floor_plan_id=plan_id, **data.model_dump())
    db.add(storey)
    db.commit()
    db.refresh(storey)
    return storey


@router.put("/{plan_id}/storeys/{storey_id}")
def update_storey(plan_id: int, storey_id: int, data: dict, db: Session = Depends(get_db)):
    storey = db.query(FloorPlanStorey).filter(FloorPlanStorey.id == storey_id).first()
    if not storey:
        raise HTTPException(status_code=404, detail="Storey not found")
    for key, value in data.items():
        if hasattr(storey, key) and value is not None:
            setattr(storey, key, value)
    db.commit()
    return {"detail": "Storey updated"}


@router.delete("/{plan_id}/storeys/{storey_id}")
def delete_storey(plan_id: int, storey_id: int, db: Session = Depends(get_db)):
    storey = db.query(FloorPlanStorey).filter(FloorPlanStorey.id == storey_id).first()
    if not storey:
        raise HTTPException(status_code=404, detail="Storey not found")
    db.delete(storey)
    db.commit()
    return {"detail": "Storey deleted"}


# --- Walls ---

@router.post("/{plan_id}/storeys/{storey_id}/walls", response_model=FloorPlanWallResponse)
def add_wall(plan_id: int, storey_id: int, data: FloorPlanWallCreate, db: Session = Depends(get_db)):
    storey = db.query(FloorPlanStorey).filter(FloorPlanStorey.id == storey_id).first()
    if not storey:
        raise HTTPException(status_code=404, detail="Storey not found")

    # Auto-generate label
    count = db.query(FloorPlanWall).filter(FloorPlanWall.storey_id == storey_id).count()
    label = f"M-{count + 1:03d}"

    wall = FloorPlanWall(storey_id=storey_id, label=label, **data.model_dump())
    db.add(wall)
    db.commit()
    db.refresh(wall)
    return wall


@router.put("/{plan_id}/walls/{wall_id}", response_model=FloorPlanWallResponse)
def update_wall(plan_id: int, wall_id: int, data: FloorPlanWallUpdate, db: Session = Depends(get_db)):
    wall = db.query(FloorPlanWall).filter(FloorPlanWall.id == wall_id).first()
    if not wall:
        raise HTTPException(status_code=404, detail="Wall not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wall, key, value)
    db.commit()
    db.refresh(wall)
    return wall


@router.delete("/{plan_id}/walls/{wall_id}")
def delete_wall(plan_id: int, wall_id: int, db: Session = Depends(get_db)):
    wall = db.query(FloorPlanWall).filter(FloorPlanWall.id == wall_id).first()
    if not wall:
        raise HTTPException(status_code=404, detail="Wall not found")
    db.delete(wall)
    db.commit()
    return {"detail": "Wall deleted"}


# --- Openings ---

@router.post("/{plan_id}/walls/{wall_id}/openings", response_model=FloorPlanOpeningResponse)
def add_opening(plan_id: int, wall_id: int, data: FloorPlanOpeningCreate, db: Session = Depends(get_db)):
    wall = db.query(FloorPlanWall).filter(FloorPlanWall.id == wall_id).first()
    if not wall:
        raise HTTPException(status_code=404, detail="Wall not found")
    opening = FloorPlanOpening(wall_id=wall_id, **data.model_dump())
    db.add(opening)
    db.commit()
    db.refresh(opening)
    return opening


@router.delete("/{plan_id}/openings/{opening_id}")
def delete_opening(plan_id: int, opening_id: int, db: Session = Depends(get_db)):
    opening = db.query(FloorPlanOpening).filter(FloorPlanOpening.id == opening_id).first()
    if not opening:
        raise HTTPException(status_code=404, detail="Opening not found")
    db.delete(opening)
    db.commit()
    return {"detail": "Opening deleted"}


# --- Bulk Save ---

@router.put("/{plan_id}/storeys/{storey_id}/bulk-save")
def bulk_save_storey(plan_id: int, storey_id: int, data: BulkSaveRequest, db: Session = Depends(get_db)):
    """Save all walls and openings for a storey at once."""
    storey = db.query(FloorPlanStorey).filter(FloorPlanStorey.id == storey_id).first()
    if not storey:
        raise HTTPException(status_code=404, detail="Storey not found")

    # Delete existing walls (cascade deletes openings)
    db.query(FloorPlanWall).filter(FloorPlanWall.storey_id == storey_id).delete()
    db.flush()

    # Create new walls
    for i, wall_data in enumerate(data.walls):
        wall = FloorPlanWall(
            storey_id=storey_id,
            start_x_mm=wall_data.start_x_mm,
            start_y_mm=wall_data.start_y_mm,
            end_x_mm=wall_data.end_x_mm,
            end_y_mm=wall_data.end_y_mm,
            thickness_mm=wall_data.thickness_mm,
            height_mm=wall_data.height_mm,
            label=f"M-{i + 1:03d}",
        )
        db.add(wall)
        db.flush()

        for op_data in wall_data.openings:
            opening = FloorPlanOpening(
                wall_id=wall.id,
                opening_type=op_data.opening_type,
                position_along_wall_mm=op_data.position_along_wall_mm,
                position_y_mm=op_data.position_y_mm,
                width_mm=op_data.width_mm,
                height_mm=op_data.height_mm,
            )
            db.add(opening)

    db.commit()
    return {"detail": "Storey saved", "walls_count": len(data.walls)}


# --- Bridge: Generate Elements ---

@router.post("/{plan_id}/generate-elements")
def generate_elements(plan_id: int, db: Session = Depends(get_db)):
    """Generate IfcElement + WallOpening records from floor plan for panelization."""
    service = FloorPlanBridgeService(db)
    try:
        result = service.generate_elements(plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# --- 3D Data ---

@router.get("/{plan_id}/3d-data")
def get_3d_data(plan_id: int, db: Session = Depends(get_db)):
    """Get 3D extrusion data for the floor plan."""
    service = FloorPlan3DService(db)
    try:
        return service.get_3d_data(plan_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
