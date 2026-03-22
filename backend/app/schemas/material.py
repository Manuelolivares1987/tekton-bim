from datetime import datetime
from pydantic import BaseModel


class MaterialCreate(BaseModel):
    name: str
    category: str
    density_kg_m3: float | None = None
    thermal_conductivity_w_mk: float | None = None
    cost_per_unit: float | None = None
    cost_unit: str = "kg"
    description: str | None = None
    is_volcanic_rock: bool = False


class MaterialUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    density_kg_m3: float | None = None
    thermal_conductivity_w_mk: float | None = None
    cost_per_unit: float | None = None
    cost_unit: str | None = None
    description: str | None = None
    is_volcanic_rock: bool | None = None


class MaterialResponse(BaseModel):
    id: int
    name: str
    category: str
    density_kg_m3: float | None
    thermal_conductivity_w_mk: float | None
    cost_per_unit: float | None
    cost_unit: str
    description: str | None
    is_volcanic_rock: bool
    created_at: datetime

    model_config = {"from_attributes": True}
