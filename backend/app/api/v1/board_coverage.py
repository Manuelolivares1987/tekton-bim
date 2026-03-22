"""Board/panel coverage calculator for wall cladding materials."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel

router = APIRouter()

# Standard board types with dimensions in meters
STANDARD_BOARDS = {
    "VOLCANBOARD": {
        "name": "Volcanboard",
        "width_m": 1.20,
        "height_m": 2.40,
        "area_m2": 1.20 * 2.40,  # 2.88
        "description": "Placa de fibrocemento 1200x2400mm",
    },
    "OSB": {
        "name": "OSB",
        "width_m": 1.22,
        "height_m": 2.44,
        "area_m2": 1.22 * 2.44,  # 2.9768
        "description": "Tablero OSB 1220x2440mm",
    },
    "YESO_STD": {
        "name": "Yeso Cartón Estándar",
        "width_m": 1.20,
        "height_m": 2.40,
        "area_m2": 1.20 * 2.40,  # 2.88
        "description": "Placa de yeso cartón 1200x2400mm",
    },
    "YESO_RH": {
        "name": "Yeso Cartón RH",
        "width_m": 1.20,
        "height_m": 2.40,
        "area_m2": 1.20 * 2.40,  # 2.88
        "description": "Placa de yeso cartón resistente a la humedad 1200x2400mm",
    },
}

WALL_IFC_TYPES = {"IfcWall", "IfcWallStandardCase", "IfcCurtainWall"}


class CustomBoardRequest(BaseModel):
    name: str
    width_m: float
    height_m: float


@router.get("/boards")
def list_board_types():
    """List available standard board types."""
    return {
        key: {
            "name": board["name"],
            "width_m": board["width_m"],
            "height_m": board["height_m"],
            "area_m2": round(board["area_m2"], 4),
            "description": board["description"],
        }
        for key, board in STANDARD_BOARDS.items()
    }


@router.get("/{model_id}/coverage")
def calculate_board_coverage(
    model_id: int,
    board_type: str = Query(default="VOLCANBOARD"),
    waste_factor: float = Query(default=1.10, ge=1.0, le=2.0),
    both_sides: bool = Query(default=True, description="Revestimiento por ambos lados del muro"),
    custom_width_m: float | None = Query(default=None, ge=0.1, le=5.0),
    custom_height_m: float | None = Query(default=None, ge=0.1, le=5.0),
    db: Session = Depends(get_db),
):
    """Calculate how many boards are needed to cover all walls in the model."""
    model = db.query(IfcModel).filter(IfcModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    # Determine board dimensions
    if custom_width_m and custom_height_m:
        board_w = custom_width_m
        board_h = custom_height_m
        board_name = f"Personalizado ({custom_width_m}x{custom_height_m}m)"
        board_area = board_w * board_h
    elif board_type in STANDARD_BOARDS:
        board_info = STANDARD_BOARDS[board_type]
        board_w = board_info["width_m"]
        board_h = board_info["height_m"]
        board_name = board_info["name"]
        board_area = board_info["area_m2"]
    else:
        raise HTTPException(status_code=400, detail=f"Tipo de placa no válido: {board_type}")

    # Get wall elements
    walls = db.query(IfcElement).filter(
        IfcElement.ifc_model_id == model_id,
        IfcElement.ifc_type.in_(WALL_IFC_TYPES),
    ).all()

    # Calculate coverage per wall
    wall_items = []
    by_storey = defaultdict(lambda: {"wall_count": 0, "total_area_m2": 0.0, "boards_needed": 0})
    total_wall_area = 0.0
    total_boards = 0

    for wall in walls:
        wall_area = wall.gross_area_m2 or 0.0
        if wall_area <= 0:
            continue

        # If both sides, double the area (interior + exterior cladding)
        coverage_area = wall_area * (2 if both_sides else 1)

        # Calculate boards needed for this wall (round up per wall)
        import math
        boards_raw = (coverage_area * waste_factor) / board_area
        boards_needed = math.ceil(boards_raw)

        # Also calculate grid-based coverage (how many boards fit width x height)
        wall_length = wall.length_m or 0
        wall_height = wall.height_m or 0
        boards_horizontal = math.ceil(wall_length / board_w) if wall_length > 0 else 0
        boards_vertical = math.ceil(wall_height / board_h) if wall_height > 0 else 0
        boards_grid = boards_horizontal * boards_vertical * (2 if both_sides else 1)

        # Use the larger of area-based or grid-based
        boards_final = max(boards_needed, boards_grid) if boards_grid > 0 else boards_needed

        total_wall_area += coverage_area
        total_boards += boards_final

        storey = wall.storey_name or "Sin nivel"
        by_storey[storey]["wall_count"] += 1
        by_storey[storey]["total_area_m2"] += coverage_area
        by_storey[storey]["boards_needed"] += boards_final

        wall_items.append({
            "element_id": wall.id,
            "name": wall.name or wall.global_id,
            "storey": storey,
            "wall_length_m": round(wall_length, 2) if wall_length else None,
            "wall_height_m": round(wall_height, 2) if wall_height else None,
            "wall_area_m2": round(wall_area, 2),
            "coverage_area_m2": round(coverage_area, 2),
            "boards_needed": boards_final,
            "boards_horizontal": boards_horizontal,
            "boards_vertical": boards_vertical,
        })

    # Sort by storey then name
    wall_items.sort(key=lambda x: (x["storey"], x["name"]))

    # Storey summary
    storey_items = [
        {
            "storey": name,
            "wall_count": data["wall_count"],
            "total_area_m2": round(data["total_area_m2"], 2),
            "boards_needed": data["boards_needed"],
        }
        for name, data in sorted(by_storey.items())
    ]

    return {
        "model_id": model_id,
        "board_type": board_type,
        "board_name": board_name,
        "board_width_m": board_w,
        "board_height_m": board_h,
        "board_area_m2": round(board_area, 4),
        "waste_factor": waste_factor,
        "both_sides": both_sides,
        "wall_count": len(wall_items),
        "total_wall_area_m2": round(total_wall_area, 2),
        "total_boards_needed": total_boards,
        "total_board_area_m2": round(total_boards * board_area, 2),
        "coverage_efficiency_pct": round((total_wall_area / (total_boards * board_area)) * 100, 1) if total_boards > 0 else 0,
        "by_storey": storey_items,
        "walls": wall_items,
    }
