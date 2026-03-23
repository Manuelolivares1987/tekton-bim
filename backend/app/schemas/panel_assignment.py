from datetime import datetime

from pydantic import BaseModel


class PanelAssignmentCreate(BaseModel):
    project_id: int
    ifc_element_id: int
    panel_id: int
    notes: str | None = None


class PanelAssignmentUpdate(BaseModel):
    panel_id: int | None = None
    panel_number: str | None = None
    notes: str | None = None


class PanelAssignmentResponse(BaseModel):
    id: int
    project_id: int
    ifc_element_id: int
    panel_id: int
    panel_number: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PanelAssignmentWithDetails(BaseModel):
    id: int
    project_id: int
    ifc_element_id: int
    panel_id: int
    panel_number: str
    notes: str | None
    element_name: str | None
    element_global_id: str
    element_ifc_type: str
    element_storey: str | None
    element_gross_area_m2: float | None
    panel_name: str
    panel_category: str
    created_at: datetime
    updated_at: datetime


class BulkAssignmentCreate(BaseModel):
    project_id: int
    ifc_element_ids: list[int]
    panel_id: int
    notes: str | None = None
