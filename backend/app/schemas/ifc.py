from datetime import datetime

from pydantic import BaseModel


class IfcModelResponse(BaseModel):
    id: int
    project_id: int
    file_name: str
    file_size_bytes: int | None
    ifc_schema: str | None
    authoring_tool: str | None
    element_count: int
    parsed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class IfcElementResponse(BaseModel):
    id: int
    global_id: str
    ifc_type: str
    name: str | None
    description: str | None
    storey_name: str | None
    type_name: str | None
    length_m: float | None
    height_m: float | None
    width_m: float | None
    gross_area_m2: float | None
    net_area_m2: float | None
    volume_m3: float | None

    model_config = {"from_attributes": True}


class IfcModelSummary(BaseModel):
    model_id: int
    file_name: str
    ifc_schema: str | None
    element_count: int
    elements_by_type: dict[str, int]
    storeys: list[str]


class IfcUploadResponse(BaseModel):
    model_id: int
    element_count: int
    parse_time_seconds: float
