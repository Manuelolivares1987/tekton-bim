from pydantic import BaseModel


class PanelScheduleItem(BaseModel):
    panel_number: str
    panel_name: str
    panel_category: str
    element_name: str | None
    element_ifc_type: str
    storey: str | None
    area_m2: float | None
    notes: str | None


class PanelScheduleResponse(BaseModel):
    project_id: int
    items: list[PanelScheduleItem]
    total_panels: int


class MaterialBOMItem(BaseModel):
    material_name: str
    category: str
    quantity: float
    unit: str
    cost_per_unit: float | None
    total_cost: float | None


class MaterialBOMResponse(BaseModel):
    project_id: int
    items: list[MaterialBOMItem]
    waste_factor: float
    total_cost: float


class AssemblySummaryResponse(BaseModel):
    project_id: int
    total_panels: int
    total_area_m2: float
    by_panel_type: dict[str, int]
    by_storey: dict[str, int]
    total_material_cost: float
