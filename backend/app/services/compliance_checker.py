"""Compliance checker — validates project against building codes.

Returns a list of findings with severity (pass/warning/fail)
and references to affected elements.

The semáforo normativo:
  GREEN  = pass     — rule satisfied
  YELLOW = warning  — marginal or needs review
  RED    = fail     — code violation
"""


from sqlalchemy.orm import Session

from app.models.bim_roof import BimRoof
from app.models.bim_wall import BimWall
from app.models.bim_wall_opening import BimWallOpening

SEVERITY_PASS = "pass"
SEVERITY_WARNING = "warning"
SEVERITY_FAIL = "fail"


def check_project_compliance(db: Session, project_id: int, country: str = "chile") -> dict:
    """Run all compliance checks for a project.

    Returns:
        {
            "status": "pass" | "warning" | "fail",
            "checks": [
                {
                    "rule_id": "dim_001",
                    "category": "dimensions",
                    "severity": "pass" | "warning" | "fail",
                    "message": "...",
                    "element_type": "wall",
                    "element_id": 42,
                    "element_label": "W-001",
                    "value": "2440 mm",
                    "limit": "max 3050 mm",
                    "code_ref": "OGUC Art 4.1.10",
                }
            ],
            "summary": {"pass": 10, "warning": 2, "fail": 1},
        }
    """
    walls = db.query(BimWall).filter(BimWall.project_id == project_id).all()
    roofs = db.query(BimRoof).filter(BimRoof.project_id == project_id).all()

    checks: list[dict] = []
    rules = _get_rules(country)

    # ── Wall checks ──
    for wall in walls:
        openings = db.query(BimWallOpening).filter(BimWallOpening.wall_id == wall.id).all()
        checks.extend(_check_wall(wall, openings, rules))

    # ── Roof checks ──
    for roof in roofs:
        checks.extend(_check_roof(roof, rules))

    # ── Project-level checks ──
    checks.extend(_check_project_level(walls, rules))

    # Compute summary
    summary = {"pass": 0, "warning": 0, "fail": 0}
    for c in checks:
        summary[c["severity"]] = summary.get(c["severity"], 0) + 1

    overall = SEVERITY_PASS
    if summary["warning"] > 0:
        overall = SEVERITY_WARNING
    if summary["fail"] > 0:
        overall = SEVERITY_FAIL

    return {
        "status": overall,
        "checks": checks,
        "summary": summary,
        "total_checks": len(checks),
    }


def _get_rules(country: str) -> dict:
    """Get country-specific dimensional and structural rules."""
    if country == "chile":
        return {
            "min_wall_height_mm": 2300,
            "max_wall_height_mm": 3050,
            "min_door_width_mm": 800,
            "min_door_height_mm": 2000,
            "min_window_area_ratio": 0.10,  # 10% of floor area
            "max_wall_length_no_bracing_mm": 8000,
            "min_hallway_width_mm": 900,
            "max_opening_width_mm": 3050,  # without engineered header
            "min_panel_width_mm": 200,
            "max_roof_pitch_deg": 45,
            "min_roof_pitch_deg": 5,  # for drainage
            "code_prefix": "OGUC / NCh",
        }
    # Default international (IRC-based)
    return {
        "min_wall_height_mm": 2134,  # 7 feet
        "max_wall_height_mm": 3660,  # 12 feet
        "min_door_width_mm": 813,    # 32 inches
        "min_door_height_mm": 2032,  # 80 inches
        "min_window_area_ratio": 0.08,
        "max_wall_length_no_bracing_mm": 7620,  # 25 feet
        "min_hallway_width_mm": 914,  # 36 inches
        "max_opening_width_mm": 3050,
        "min_panel_width_mm": 200,
        "max_roof_pitch_deg": 60,
        "min_roof_pitch_deg": 2,
        "code_prefix": "IRC",
    }


def _check_wall(wall: BimWall, openings: list[BimWallOpening], rules: dict) -> list[dict]:
    checks = []
    prefix = rules["code_prefix"]

    # Wall height
    if wall.height_mm < rules["min_wall_height_mm"]:
        checks.append(_finding(
            "wall_height_min", "dimensions", SEVERITY_FAIL,
            f"Altura de muro {wall.height_mm}mm menor al mínimo {rules['min_wall_height_mm']}mm",
            "wall", wall.id, wall.label,
            f"{wall.height_mm} mm", f"min {rules['min_wall_height_mm']} mm",
            f"{prefix} Art 4.1.10",
        ))
    elif wall.height_mm > rules["max_wall_height_mm"]:
        checks.append(_finding(
            "wall_height_max", "dimensions", SEVERITY_FAIL,
            f"Altura de muro {wall.height_mm}mm excede máximo {rules['max_wall_height_mm']}mm",
            "wall", wall.id, wall.label,
            f"{wall.height_mm} mm", f"max {rules['max_wall_height_mm']} mm",
            f"{prefix} Art 4.1.10",
        ))
    else:
        checks.append(_finding(
            "wall_height", "dimensions", SEVERITY_PASS,
            f"Altura de muro {wall.height_mm}mm dentro de rango permitido",
            "wall", wall.id, wall.label,
        ))

    # Wall length without bracing
    if wall.length_mm and wall.length_mm > rules["max_wall_length_no_bracing_mm"]:
        checks.append(_finding(
            "wall_bracing", "structural", SEVERITY_WARNING,
            f"Muro de {wall.length_mm:.0f}mm excede {rules['max_wall_length_no_bracing_mm']}mm sin arriostramiento",
            "wall", wall.id, wall.label,
            f"{wall.length_mm:.0f} mm", f"max {rules['max_wall_length_no_bracing_mm']} mm",
            f"{prefix} NCh1928",
        ))

    # Opening checks
    for op in openings:
        if op.opening_type == "door":
            if op.width_mm < rules["min_door_width_mm"]:
                checks.append(_finding(
                    "door_width", "openings", SEVERITY_FAIL,
                    f"Puerta {op.label or ''} ancho {op.width_mm}mm menor al mínimo {rules['min_door_width_mm']}mm",
                    "opening", op.id, op.label or f"Puerta en {wall.label}",
                    f"{op.width_mm} mm", f"min {rules['min_door_width_mm']} mm",
                    f"{prefix} Art 4.2.7",
                ))
            if op.height_mm < rules["min_door_height_mm"]:
                checks.append(_finding(
                    "door_height", "openings", SEVERITY_FAIL,
                    f"Puerta {op.label or ''} alto {op.height_mm}mm menor al mínimo {rules['min_door_height_mm']}mm",
                    "opening", op.id, op.label or f"Puerta en {wall.label}",
                    f"{op.height_mm} mm", f"min {rules['min_door_height_mm']} mm",
                    f"{prefix} Art 4.2.7",
                ))

        # Opening width structural limit
        if op.width_mm > rules["max_opening_width_mm"]:
            checks.append(_finding(
                "opening_width_structural", "structural", SEVERITY_WARNING,
                f"Abertura {op.width_mm}mm supera {rules['max_opening_width_mm']}mm — requiere dintel diseñado",
                "opening", op.id, op.label or f"Abertura en {wall.label}",
                f"{op.width_mm} mm", f"max {rules['max_opening_width_mm']} mm sin dintel especial",
                f"{prefix} NCh1928",
            ))

        # Opening position: must not extend beyond wall
        if op.position_along_mm + op.width_mm > (wall.length_mm or 0):
            checks.append(_finding(
                "opening_position", "openings", SEVERITY_FAIL,
                f"Abertura {op.label or ''} excede el largo del muro",
                "opening", op.id, op.label or f"Abertura en {wall.label}",
                f"pos {op.position_along_mm} + ancho {op.width_mm} mm",
                f"largo muro {wall.length_mm:.0f} mm",
                "Geometría",
            ))

    return checks


def _check_roof(roof: BimRoof, rules: dict) -> list[dict]:
    checks = []
    prefix = rules["code_prefix"]

    if roof.pitch_deg < rules["min_roof_pitch_deg"]:
        checks.append(_finding(
            "roof_pitch_min", "roof", SEVERITY_WARNING,
            f"Pendiente de techo {roof.pitch_deg}° menor al mínimo recomendado {rules['min_roof_pitch_deg']}°",
            "roof", roof.id, roof.label,
            f"{roof.pitch_deg}°", f"min {rules['min_roof_pitch_deg']}°",
            f"{prefix} recomendación",
        ))
    elif roof.pitch_deg > rules["max_roof_pitch_deg"]:
        checks.append(_finding(
            "roof_pitch_max", "roof", SEVERITY_WARNING,
            f"Pendiente de techo {roof.pitch_deg}° excede máximo recomendado {rules['max_roof_pitch_deg']}°",
            "roof", roof.id, roof.label,
            f"{roof.pitch_deg}°", f"max {rules['max_roof_pitch_deg']}°",
            f"{prefix} recomendación",
        ))
    else:
        checks.append(_finding(
            "roof_pitch", "roof", SEVERITY_PASS,
            f"Pendiente de techo {roof.pitch_deg}° dentro de rango",
            "roof", roof.id, roof.label,
        ))

    return checks


def _check_project_level(walls: list[BimWall], rules: dict) -> list[dict]:
    checks = []

    if not walls:
        checks.append(_finding(
            "no_walls", "general", SEVERITY_WARNING,
            "El proyecto no tiene muros definidos",
            "project", 0, "Proyecto",
        ))
        return checks

    # Check if any walls exist
    checks.append(_finding(
        "walls_defined", "general", SEVERITY_PASS,
        f"{len(walls)} muros definidos en el proyecto",
        "project", 0, "Proyecto",
    ))

    # Total wall area
    total_wall_area = sum((w.length_mm or 0) * w.height_mm / 1_000_000 for w in walls)
    checks.append(_finding(
        "wall_area", "general", SEVERITY_PASS,
        f"Área total de muros: {total_wall_area:.1f} m²",
        "project", 0, "Proyecto",
        f"{total_wall_area:.1f} m²", "",
    ))

    return checks


def _finding(
    rule_id: str, category: str, severity: str, message: str,
    element_type: str, element_id: int, element_label: str,
    value: str = "", limit: str = "", code_ref: str = "",
) -> dict:
    return {
        "rule_id": rule_id,
        "category": category,
        "severity": severity,
        "message": message,
        "element_type": element_type,
        "element_id": element_id,
        "element_label": element_label,
        "value": value,
        "limit": limit,
        "code_ref": code_ref,
    }
