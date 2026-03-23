"""Plumbing design API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mep import (
    PipeSizingRequest,
    PipeSizingResult,
    PressureCalcRequest,
    PressureCalcResult,
)
from app.services.plumbing_service import PlumbingDesignService

router = APIRouter()


@router.post("/pipe-sizing", response_model=PipeSizingResult)
def size_pipe(data: PipeSizingRequest, db: Session = Depends(get_db)):
    """Size supply pipe for given flow rate."""
    service = PlumbingDesignService(db)
    return service.size_supply_pipe(
        flow_gpm=data.flow_gpm,
        velocity_target_fps=data.velocity_target_fps,
        pipe_material=data.pipe_material,
    )


@router.post("/pressure", response_model=PressureCalcResult)
def calculate_pressure(data: PressureCalcRequest, db: Session = Depends(get_db)):
    """Calculate system pressure at most remote fixture."""
    service = PlumbingDesignService(db)
    return service.calculate_pressure(
        supply_pressure_psi=data.supply_pressure_psi,
        elevation_ft=data.elevation_ft,
        total_pipe_length_ft=data.total_pipe_length_ft,
        total_fixture_units=data.total_fixture_units,
        pipe_material=data.pipe_material,
        pipe_diameter_inches=data.pipe_diameter_inches,
    )
