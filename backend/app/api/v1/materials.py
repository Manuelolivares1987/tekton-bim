"""Material library API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.material import MaterialCreate, MaterialResponse, MaterialUpdate
from app.services.material_service import MaterialService

router = APIRouter()


@router.get("/", response_model=list[MaterialResponse])
def list_materials(category: str | None = None, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return service.get_all_materials(category)


@router.post("/", response_model=MaterialResponse)
def create_material(data: MaterialCreate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return service.create_material(**data.model_dump())


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    material = service.get_material(material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.put("/{material_id}", response_model=MaterialResponse)
def update_material(material_id: int, data: MaterialUpdate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    material = service.update_material(material_id, **data.model_dump(exclude_unset=True))
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.delete("/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    if not service.delete_material(material_id):
        raise HTTPException(status_code=404, detail="Material not found")
    return {"status": "deleted"}
