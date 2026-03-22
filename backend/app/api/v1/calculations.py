"""Calculation API endpoints: quantity takeoff, wall area, volcanic rock."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.quantity_takeoff import QuantityTakeoffService
from app.services.wall_calculator import WallAreaCalculator
from app.services.volcanic_rock import VolcanicRockCalculator
from app.schemas.calculation import (
    QuantityTakeoffRequest,
    QuantityTakeoffResponse,
    WallAreaRequest,
    WallAreaResult,
    VolcanicRockByAreaRequest,
    VolcanicRockByPanelRequest,
    VolcanicRockResult,
)

router = APIRouter()


@router.post("/quantity-takeoff", response_model=QuantityTakeoffResponse)
def run_quantity_takeoff(data: QuantityTakeoffRequest, db: Session = Depends(get_db)):
    """Generate full quantity takeoff for an IFC model."""
    service = QuantityTakeoffService(db)
    result = service.generate_takeoff(data.model_id)
    if not result["items"]:
        raise HTTPException(status_code=404, detail="No elements found for this model")
    return result


@router.post("/quantity-takeoff/export")
def export_quantity_takeoff(data: QuantityTakeoffRequest, db: Session = Depends(get_db)):
    """Export quantity takeoff as CSV."""
    service = QuantityTakeoffService(db)
    csv_content = service.export_to_csv(data.model_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=quantity_takeoff.csv"},
    )


@router.post("/wall-area", response_model=WallAreaResult)
def calculate_wall_area(data: WallAreaRequest, db: Session = Depends(get_db)):
    """Calculate wall area for an IFC model."""
    calc = WallAreaCalculator(db)
    result = calc.calculate_total_wall_area(data.model_id, data.include_openings)
    return result


@router.post("/volcanic-rock/by-area", response_model=VolcanicRockResult)
def calculate_volcanic_rock_by_area(
    data: VolcanicRockByAreaRequest,
    db: Session = Depends(get_db),
):
    """Calculate volcanic rock by wall area (Method 1)."""
    calc = VolcanicRockCalculator(db)

    if data.model_id:
        # Use IFC model wall area
        result = calc.calculate_from_ifc_model(
            model_id=data.model_id,
            thickness_mm=data.thickness_mm,
            density_kg_m3=data.density_kg_m3,
            waste_factor_pct=data.waste_factor_pct,
        )
    elif data.wall_area_m2 is not None:
        # Use manually provided area
        result = calc.calculate_by_wall_area(
            wall_area_m2=data.wall_area_m2,
            thickness_mm=data.thickness_mm,
            density_kg_m3=data.density_kg_m3,
            waste_factor_pct=data.waste_factor_pct,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either model_id or wall_area_m2",
        )

    return result


@router.post("/volcanic-rock/by-panel", response_model=VolcanicRockResult)
def calculate_volcanic_rock_by_panel(
    data: VolcanicRockByPanelRequest,
    db: Session = Depends(get_db),
):
    """Calculate volcanic rock by panel type (Method 2)."""
    calc = VolcanicRockCalculator(db)
    try:
        result = calc.calculate_by_panel_type(data.panel_type_id, data.quantity)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
