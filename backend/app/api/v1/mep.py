"""MEP API — manage mechanical, electrical, plumbing objects."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.bim_mep import MepObject

router = APIRouter()


class MepObjectCreate(BaseModel):
    discipline: str  # "electrical" | "plumbing" | "hvac"
    object_type: str
    wall_id: int | None = None
    storey_id: int | None = None
    pos_x_mm: float = 0.0
    pos_y_mm: float = 0.0
    pos_z_mm: float = 0.0
    position_along_wall_mm: float | None = None
    power_watts: float | None = None
    flow_rate_lpm: float | None = None
    pipe_diameter_mm: float | None = None
    circuit_id: str | None = None
    notes: str | None = None


@router.get("/project/{project_id}")
def list_mep_objects(project_id: int, discipline: str | None = None, db: Session = Depends(get_db)):
    query = db.query(MepObject).filter(MepObject.project_id == project_id)
    if discipline:
        query = query.filter(MepObject.discipline == discipline)
    objects = query.order_by(MepObject.discipline, MepObject.label).all()
    return [_to_dict(o) for o in objects]


@router.post("/project/{project_id}")
def create_mep_object(project_id: int, data: MepObjectCreate, db: Session = Depends(get_db)):
    count = db.query(MepObject).filter(
        MepObject.project_id == project_id,
        MepObject.discipline == data.discipline,
    ).count()
    prefix = {"electrical": "E", "plumbing": "P", "hvac": "H"}.get(data.discipline, "M")
    label = f"{prefix}-{count + 1:03d}"

    obj = MepObject(
        project_id=project_id,
        label=label,
        **data.model_dump(),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_dict(obj)


@router.delete("/{object_id}")
def delete_mep_object(object_id: int, db: Session = Depends(get_db)):
    obj = db.query(MepObject).filter(MepObject.id == object_id).first()
    if not obj:
        raise HTTPException(404, "MEP object not found")
    db.delete(obj)
    db.commit()
    return {"detail": "Deleted"}


def _to_dict(o: MepObject) -> dict:
    return {
        "id": o.id,
        "project_id": o.project_id,
        "label": o.label,
        "discipline": o.discipline,
        "object_type": o.object_type,
        "wall_id": o.wall_id,
        "storey_id": o.storey_id,
        "pos_x_mm": o.pos_x_mm,
        "pos_y_mm": o.pos_y_mm,
        "pos_z_mm": o.pos_z_mm,
        "position_along_wall_mm": o.position_along_wall_mm,
        "power_watts": o.power_watts,
        "flow_rate_lpm": o.flow_rate_lpm,
        "pipe_diameter_mm": o.pipe_diameter_mm,
        "circuit_id": o.circuit_id,
        "notes": o.notes,
    }
