from pydantic import BaseModel


class QuantityTakeoffItem(BaseModel):
    category: str
    ifc_type: str
    type_name: str | None
    count: int
    total_area_m2: float | None
    total_volume_m3: float | None
    total_length_m: float | None


class QuantityTakeoffResponse(BaseModel):
    model_id: int
    items: list[QuantityTakeoffItem]
    total_elements: int


class WallAreaResult(BaseModel):
    model_id: int
    total_gross_area_m2: float
    total_net_area_m2: float
    by_storey: dict[str, float]
    by_type: dict[str, float]
    wall_count: int


class VolcanicRockByAreaRequest(BaseModel):
    model_id: int | None = None
    wall_area_m2: float | None = None
    thickness_mm: float = 80.0
    density_kg_m3: float = 80.0
    waste_factor_pct: float = 5.0


class VolcanicRockByPanelRequest(BaseModel):
    panel_type_id: int
    quantity: int


class VolcanicRockResult(BaseModel):
    method: str
    area_m2: float | None = None
    thickness_mm: float | None = None
    volume_m3: float | None = None
    weight_kg: float
    weight_with_waste_kg: float | None = None
    density_kg_m3: float | None = None
    panel_type_name: str | None = None
    quantity: int | None = None
    kg_per_unit: float | None = None


class QuantityTakeoffRequest(BaseModel):
    model_id: int


class WallAreaRequest(BaseModel):
    model_id: int
    include_openings: bool = True
