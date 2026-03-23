"""Electrical design API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mep import (
    LoadCalculationRequest,
    LoadCalculationResult,
    WireSizingRequest,
    WireSizingResult,
)
from app.services.electrical_service import ElectricalDesignService

router = APIRouter()


@router.post("/load", response_model=LoadCalculationResult)
def calculate_load(data: LoadCalculationRequest, db: Session = Depends(get_db)):
    """Calculate branch circuit load per NEC Article 220."""
    service = ElectricalDesignService(db)
    return service.calculate_branch_circuit_load(
        total_watts=data.total_watts,
        voltage=data.voltage,
        phase=data.phase,
        power_factor=data.power_factor,
        is_continuous=data.is_continuous,
    )


@router.post("/wire-sizing", response_model=WireSizingResult)
def size_wire(data: WireSizingRequest, db: Session = Depends(get_db)):
    """Size wire considering ampacity and voltage drop."""
    service = ElectricalDesignService(db)
    return service.size_wire_for_circuit(
        load_amps=data.load_amps,
        length_m=data.length_m,
        voltage=data.voltage,
        max_drop_pct=data.max_drop_pct,
        phase=data.phase,
    )
