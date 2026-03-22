from pydantic import BaseModel


class CircuitCreate(BaseModel):
    project_id: int
    circuit_name: str
    panel_name: str | None = None
    phase: str = "single"
    voltage: float = 120.0


class CircuitResponse(BaseModel):
    id: int
    project_id: int
    circuit_name: str
    panel_name: str | None
    phase: str
    voltage: float
    breaker_amps: float | None
    wire_size_awg: str | None
    conduit_size: str | None
    total_load_watts: float | None
    voltage_drop_pct: float | None

    model_config = {"from_attributes": True}


class LoadCalculationRequest(BaseModel):
    total_watts: float
    voltage: float = 120.0
    phase: str = "single"
    power_factor: float = 1.0
    is_continuous: bool = False


class LoadCalculationResult(BaseModel):
    current_amps: float
    adjusted_amps: float
    recommended_breaker_amps: float
    recommended_wire_size: str


class WireSizingRequest(BaseModel):
    load_amps: float
    length_m: float
    voltage: float = 120.0
    max_drop_pct: float = 3.0
    phase: str = "single"


class WireSizingResult(BaseModel):
    wire_size_awg: str
    ampacity: float
    voltage_drop_pct: float
    voltage_drop_volts: float


class FixtureCreate(BaseModel):
    project_id: int
    fixture_type: str
    hot_water: bool = False
    cold_water: bool = True
    location_x: float | None = None
    location_y: float | None = None
    location_z: float | None = None
    storey_name: str | None = None


class FixtureResponse(BaseModel):
    id: int
    project_id: int
    fixture_type: str
    fixture_units: float
    hot_water: bool
    cold_water: bool
    drain_size_mm: float | None

    model_config = {"from_attributes": True}


class PipeSizingRequest(BaseModel):
    flow_gpm: float
    velocity_target_fps: float = 5.0
    pipe_material: str = "copper"


class PipeSizingResult(BaseModel):
    diameter_inches: float
    diameter_mm: float
    nominal_size: str
    actual_velocity_fps: float


class PressureCalcRequest(BaseModel):
    supply_pressure_psi: float
    elevation_ft: float
    total_pipe_length_ft: float
    total_fixture_units: float
    pipe_material: str = "copper"
    pipe_diameter_inches: float = 0.75


class PressureCalcResult(BaseModel):
    supply_pressure_psi: float
    static_loss_psi: float
    friction_loss_psi: float
    available_pressure_psi: float
    min_fixture_pressure_psi: float
    is_adequate: bool
