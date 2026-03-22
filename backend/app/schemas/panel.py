from datetime import datetime
from pydantic import BaseModel


class PanelLayerCreate(BaseModel):
    material_id: int
    layer_order: int
    thickness_mm: float
    description: str | None = None


class PanelLayerUpdate(BaseModel):
    material_id: int | None = None
    layer_order: int | None = None
    thickness_mm: float | None = None
    description: str | None = None


class PanelLayerResponse(BaseModel):
    id: int
    material_id: int
    layer_order: int
    thickness_mm: float
    description: str | None

    model_config = {"from_attributes": True}


class PanelCreate(BaseModel):
    project_id: int | None = None
    name: str
    category: str
    description: str | None = None
    volcanic_rock_kg_per_unit: float | None = None
    layers: list[PanelLayerCreate] = []


class PanelUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    volcanic_rock_kg_per_unit: float | None = None


class PanelResponse(BaseModel):
    id: int
    project_id: int | None
    name: str
    category: str
    description: str | None
    total_thickness_mm: float | None
    total_weight_per_m2_kg: float | None
    r_value_m2k_w: float | None
    volcanic_rock_kg_per_unit: float | None
    layers: list[PanelLayerResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LayerReorderRequest(BaseModel):
    layer_ids: list[int]
