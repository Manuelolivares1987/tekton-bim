"""Roof API — create and manage roof/techumbre geometry."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.roof_service import RoofService

router = APIRouter()


class RoofCreate(BaseModel):
    roof_type: str = "gable"
    pitch_deg: float = 25.0
    overhang_mm: float = 400.0


@router.post("/project/{project_id}/roofs")
def create_roof(project_id: int, data: RoofCreate, db: Session = Depends(get_db)):
    svc = RoofService(db)
    try:
        return svc.create_roof_from_walls(project_id, data.roof_type, data.pitch_deg, data.overhang_mm)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/project/{project_id}/roofs")
def list_roofs(project_id: int, db: Session = Depends(get_db)):
    return RoofService(db).list_roofs(project_id)


@router.get("/roofs/{roof_id}/geometry")
def get_roof_geometry(roof_id: int, db: Session = Depends(get_db)):
    svc = RoofService(db)
    try:
        return svc.get_roof_geometry(roof_id)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@router.delete("/roofs/{roof_id}")
def delete_roof(roof_id: int, db: Session = Depends(get_db)):
    RoofService(db).delete_roof(roof_id)
    return {"detail": "Deleted"}
