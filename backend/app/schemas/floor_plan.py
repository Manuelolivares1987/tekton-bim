"""Pydantic schemas for floor plan endpoints."""

from datetime import datetime

from pydantic import BaseModel


class FloorPlanCreate(BaseModel):
    project_id: int
    name: str
    description: str | None = None
    grid_size_mm: float = 100.0
    default_wall_thickness_mm: float = 150.0
    default_wall_height_mm: float = 2440.0


class FloorPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    grid_size_mm: float | None = None
    default_wall_thickness_mm: float | None = None
    default_wall_height_mm: float | None = None


class FloorPlanStoreyCreate(BaseModel):
    name: str
    level_index: int
    elevation_mm: float = 0.0
    height_mm: float = 2440.0


class FloorPlanWallCreate(BaseModel):
    start_x_mm: float
    start_y_mm: float
    end_x_mm: float
    end_y_mm: float
    thickness_mm: float = 150.0
    height_mm: float | None = None


class FloorPlanWallUpdate(BaseModel):
    start_x_mm: float | None = None
    start_y_mm: float | None = None
    end_x_mm: float | None = None
    end_y_mm: float | None = None
    thickness_mm: float | None = None
    height_mm: float | None = None


class FloorPlanOpeningCreate(BaseModel):
    opening_type: str
    position_along_wall_mm: float
    position_y_mm: float = 0.0
    width_mm: float
    height_mm: float


class FloorPlanOpeningResponse(BaseModel):
    id: int
    wall_id: int
    opening_type: str
    position_along_wall_mm: float
    position_y_mm: float
    width_mm: float
    height_mm: float

    model_config = {"from_attributes": True}


class FloorPlanWallResponse(BaseModel):
    id: int
    storey_id: int
    start_x_mm: float
    start_y_mm: float
    end_x_mm: float
    end_y_mm: float
    thickness_mm: float
    height_mm: float | None
    length_mm: float
    label: str | None
    ifc_element_id: int | None
    openings: list[FloorPlanOpeningResponse] = []

    model_config = {"from_attributes": True}


class FloorPlanStoreyResponse(BaseModel):
    id: int
    name: str
    level_index: int
    elevation_mm: float
    height_mm: float
    walls: list[FloorPlanWallResponse] = []

    model_config = {"from_attributes": True}


class FloorPlanResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None
    grid_size_mm: float
    default_wall_thickness_mm: float
    default_wall_height_mm: float
    ifc_model_id: int | None
    storeys: list[FloorPlanStoreyResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkWallData(BaseModel):
    id: int | None = None  # null = new wall
    start_x_mm: float
    start_y_mm: float
    end_x_mm: float
    end_y_mm: float
    thickness_mm: float = 150.0
    height_mm: float | None = None
    openings: list[FloorPlanOpeningCreate] = []


class BulkSaveRequest(BaseModel):
    walls: list[BulkWallData]
