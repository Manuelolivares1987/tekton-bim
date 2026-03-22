"""Lumber/wood quantity takeoff API endpoints."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel

router = APIRouter()

# IFC types that represent wood framing
LUMBER_IFC_TYPES = {"IfcMember", "IfcColumn", "IfcBeam"}

# Known lumber dimension keywords (from type_name)
LUMBER_KEYWORDS = ["lumber", "wood", "timber", "madera", "pino", "pine", "osb", "plywood"]


def _is_lumber(element) -> bool:
    """Check if an element is a lumber/wood piece based on type_name."""
    type_name = (element.type_name or "").lower()
    return any(kw in type_name for kw in LUMBER_KEYWORDS)


def _parse_lumber_size(type_name: str) -> str:
    """Extract lumber dimension from type_name like 'M_Dimension Lumber:2x4'."""
    if not type_name:
        return "Unknown"
    # Look for patterns like 2x4, 2x3, 2x8, etc.
    parts = type_name.split(":")
    for part in parts:
        part = part.strip()
        if "x" in part.lower() and any(c.isdigit() for c in part):
            # Check if it looks like a dimension (e.g., "2x4", "2x8")
            try:
                dims = part.lower().split("x")
                if len(dims) == 2 and all(d.strip().replace(".", "").isdigit() for d in dims):
                    return part.strip()
            except ValueError:
                pass
    return type_name.split(":")[-1].strip() if ":" in type_name else type_name


@router.get("/{model_id}/lumber")
def get_lumber_takeoff(
    model_id: int,
    waste_factor: float = Query(default=1.1, ge=1.0, le=2.0),
    db: Session = Depends(get_db),
):
    """Get lumber quantity takeoff grouped by dimension and storey."""
    model = db.query(IfcModel).filter(IfcModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    elements = db.query(IfcElement).filter(
        IfcElement.ifc_model_id == model_id,
        IfcElement.ifc_type.in_(LUMBER_IFC_TYPES),
    ).all()

    # Filter to actual lumber pieces
    lumber_elements = [e for e in elements if _is_lumber(e)]

    # Group by lumber size
    by_size: dict[str, dict] = defaultdict(lambda: {
        "count": 0,
        "total_length_m": 0.0,
        "total_volume_m3": 0.0,
        "total_area_m2": 0.0,
        "elements": [],
    })

    # Group by storey
    by_storey: dict[str, dict] = defaultdict(lambda: {
        "count": 0,
        "total_length_m": 0.0,
        "total_volume_m3": 0.0,
    })

    # Group by ifc_type
    by_ifc_type: dict[str, int] = defaultdict(int)

    for el in lumber_elements:
        size = _parse_lumber_size(el.type_name or "")
        storey = el.storey_name or "Sin nivel"
        length = el.length_m or 0
        volume = el.volume_m3 or 0
        area = el.gross_area_m2 or 0

        by_size[size]["count"] += 1
        by_size[size]["total_length_m"] += length
        by_size[size]["total_volume_m3"] += volume
        by_size[size]["total_area_m2"] += area

        by_storey[storey]["count"] += 1
        by_storey[storey]["total_length_m"] += length
        by_storey[storey]["total_volume_m3"] += volume

        by_ifc_type[el.ifc_type] += 1

    # Calculate totals
    total_count = len(lumber_elements)
    total_length_m = sum(d["total_length_m"] for d in by_size.values())
    total_volume_m3 = sum(d["total_volume_m3"] for d in by_size.values())

    # Board feet: 1 board foot = 1/12 cubic foot; 1 m3 = 35.3147 ft3
    total_board_feet = total_volume_m3 * 35.3147 * 12

    # Apply waste factor
    total_length_with_waste = total_length_m * waste_factor
    total_volume_with_waste = total_volume_m3 * waste_factor
    total_board_feet_with_waste = total_board_feet * waste_factor

    # Build size breakdown with waste
    size_items = []
    for size_name, data in sorted(by_size.items()):
        board_feet = data["total_volume_m3"] * 35.3147 * 12
        size_items.append({
            "lumber_size": size_name,
            "count": data["count"],
            "total_length_m": round(data["total_length_m"], 2),
            "total_length_ft": round(data["total_length_m"] * 3.28084, 1),
            "total_volume_m3": round(data["total_volume_m3"], 4),
            "board_feet": round(board_feet, 1),
            "length_with_waste_m": round(data["total_length_m"] * waste_factor, 2),
            "board_feet_with_waste": round(board_feet * waste_factor, 1),
        })

    # Build storey breakdown
    storey_items = []
    for storey_name, data in sorted(by_storey.items()):
        storey_items.append({
            "storey": storey_name,
            "count": data["count"],
            "total_length_m": round(data["total_length_m"], 2),
            "total_volume_m3": round(data["total_volume_m3"], 4),
        })

    return {
        "model_id": model_id,
        "waste_factor": waste_factor,
        "total_lumber_pieces": total_count,
        "total_length_m": round(total_length_m, 2),
        "total_length_ft": round(total_length_m * 3.28084, 1),
        "total_volume_m3": round(total_volume_m3, 4),
        "total_board_feet": round(total_board_feet, 1),
        "total_length_with_waste_m": round(total_length_with_waste, 2),
        "total_volume_with_waste_m3": round(total_volume_with_waste, 4),
        "total_board_feet_with_waste": round(total_board_feet_with_waste, 1),
        "by_size": size_items,
        "by_storey": storey_items,
        "by_ifc_type": dict(by_ifc_type),
        "non_lumber_framing": len(elements) - total_count,
    }
