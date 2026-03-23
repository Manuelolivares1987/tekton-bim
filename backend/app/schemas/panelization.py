"""Pydantic schemas for panelization endpoints."""

from datetime import datetime

from pydantic import BaseModel

# --- SIP Panel Config ---

class SipPanelConfigCreate(BaseModel):
    project_id: int
    name: str
    core_material_id: int
    core_thickness_mm: float
    skin_material_id: int
    skin_thickness_mm: float
    standard_width_mm: float = 1220.0
    standard_height_mm: float = 2440.0
    max_width_mm: float = 1220.0
    max_height_mm: float = 3660.0
    min_panel_width_mm: float = 200.0
    joint_type: str = "spline"
    spline_material_id: int | None = None
    spline_width_mm: float = 89.0
    spline_depth_mm: float = 38.0


class SipPanelConfigUpdate(BaseModel):
    name: str | None = None
    core_material_id: int | None = None
    core_thickness_mm: float | None = None
    skin_material_id: int | None = None
    skin_thickness_mm: float | None = None
    standard_width_mm: float | None = None
    standard_height_mm: float | None = None
    max_width_mm: float | None = None
    max_height_mm: float | None = None
    min_panel_width_mm: float | None = None
    joint_type: str | None = None
    spline_material_id: int | None = None
    spline_width_mm: float | None = None
    spline_depth_mm: float | None = None


class SipPanelConfigResponse(BaseModel):
    id: int
    project_id: int
    name: str
    core_material_id: int
    core_thickness_mm: float
    skin_material_id: int
    skin_thickness_mm: float
    standard_width_mm: float
    standard_height_mm: float
    max_width_mm: float
    max_height_mm: float
    min_panel_width_mm: float
    joint_type: str
    spline_material_id: int | None
    spline_width_mm: float
    spline_depth_mm: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Wall Openings ---

class WallOpeningCreate(BaseModel):
    ifc_element_id: int
    opening_type: str  # door, window
    position_x_mm: float
    position_y_mm: float
    width_mm: float
    height_mm: float
    rough_opening_width_mm: float | None = None
    rough_opening_height_mm: float | None = None


class WallOpeningResponse(BaseModel):
    id: int
    ifc_element_id: int
    opening_ifc_element_id: int | None
    opening_type: str
    position_x_mm: float
    position_y_mm: float
    width_mm: float
    height_mm: float
    rough_opening_width_mm: float
    rough_opening_height_mm: float
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Panelization ---

class PanelizeWallRequest(BaseModel):
    sip_config_id: int
    wall_prefix: str | None = None  # optional custom prefix for panel labels


class BulkPanelizeRequest(BaseModel):
    project_id: int
    model_id: int
    sip_config_id: int
    storey_filter: str | None = None  # optional: only panelize walls in this storey


class PanelInstanceResponse(BaseModel):
    id: int
    panel_label: str
    sequence_order: int
    position_x_mm: float
    position_y_mm: float
    width_mm: float
    height_mm: float
    is_custom_cut: bool
    has_opening: bool
    opening_type: str | None
    opening_x_mm: float | None
    opening_y_mm: float | None
    opening_width_mm: float | None
    opening_height_mm: float | None
    panel_type: str
    weight_kg: float
    area_m2: float
    notes: str | None

    model_config = {"from_attributes": True}


class PanelizationResultResponse(BaseModel):
    id: int
    project_id: int
    ifc_element_id: int
    config_type: str
    sip_config_id: int | None
    status: str
    wall_name: str | None = None
    wall_length_mm: float | None = None
    wall_height_mm: float | None = None
    storey: str | None = None
    panel_count: int = 0
    total_area_m2: float = 0.0
    total_weight_kg: float = 0.0
    panels: list[PanelInstanceResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
