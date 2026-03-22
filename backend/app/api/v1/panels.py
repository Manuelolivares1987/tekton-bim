"""Panel and partition management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.panel_service import PanelService
from app.schemas.panel import (
    PanelCreate,
    PanelUpdate,
    PanelResponse,
    PanelLayerCreate,
    PanelLayerUpdate,
    PanelLayerResponse,
    LayerReorderRequest,
)

router = APIRouter()


@router.get("/", response_model=list[PanelResponse])
def list_panels(project_id: int | None = None, db: Session = Depends(get_db)):
    service = PanelService(db)
    return service.get_all_panels(project_id)


@router.post("/", response_model=PanelResponse)
def create_panel(data: PanelCreate, db: Session = Depends(get_db)):
    service = PanelService(db)
    layers = [layer.model_dump() for layer in data.layers] if data.layers else None
    panel = service.create_panel(
        name=data.name,
        category=data.category,
        project_id=data.project_id,
        description=data.description,
        volcanic_rock_kg_per_unit=data.volcanic_rock_kg_per_unit,
        layers=layers,
    )
    return panel


@router.get("/{panel_id}", response_model=PanelResponse)
def get_panel(panel_id: int, db: Session = Depends(get_db)):
    service = PanelService(db)
    panel = service.get_panel(panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    return panel


@router.put("/{panel_id}", response_model=PanelResponse)
def update_panel(panel_id: int, data: PanelUpdate, db: Session = Depends(get_db)):
    service = PanelService(db)
    panel = service.update_panel(
        panel_id,
        name=data.name,
        category=data.category,
        description=data.description,
        volcanic_rock_kg_per_unit=data.volcanic_rock_kg_per_unit,
    )
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    return panel


@router.delete("/{panel_id}")
def delete_panel(panel_id: int, db: Session = Depends(get_db)):
    service = PanelService(db)
    if not service.delete_panel(panel_id):
        raise HTTPException(status_code=404, detail="Panel not found")
    return {"status": "deleted"}


@router.post("/{panel_id}/layers", response_model=PanelLayerResponse)
def add_layer(panel_id: int, data: PanelLayerCreate, db: Session = Depends(get_db)):
    service = PanelService(db)
    layer = service.add_layer(
        panel_id=panel_id,
        material_id=data.material_id,
        layer_order=data.layer_order,
        thickness_mm=data.thickness_mm,
        description=data.description,
    )
    if not layer:
        raise HTTPException(status_code=404, detail="Panel not found")
    return layer


@router.put("/{panel_id}/layers/{layer_id}", response_model=PanelLayerResponse)
def update_layer(panel_id: int, layer_id: int, data: PanelLayerUpdate, db: Session = Depends(get_db)):
    service = PanelService(db)
    layer = service.update_layer(
        layer_id,
        material_id=data.material_id,
        layer_order=data.layer_order,
        thickness_mm=data.thickness_mm,
        description=data.description,
    )
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer


@router.delete("/{panel_id}/layers/{layer_id}")
def delete_layer(panel_id: int, layer_id: int, db: Session = Depends(get_db)):
    service = PanelService(db)
    if not service.delete_layer(layer_id):
        raise HTTPException(status_code=404, detail="Layer not found")
    return {"status": "deleted"}


@router.post("/{panel_id}/layers/reorder")
def reorder_layers(panel_id: int, data: LayerReorderRequest, db: Session = Depends(get_db)):
    service = PanelService(db)
    service.reorder_layers(panel_id, data.layer_ids)
    return {"status": "reordered"}
