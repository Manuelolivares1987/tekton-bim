"""SIP panel panelization engine.

Takes a wall (length, height) with openings and a SIP configuration,
and divides it into individual fabricable SIP panels.
"""

import math
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel
from app.models.material import Material
from app.models.sip_panel_config import SipPanelConfig
from app.models.wall_opening import WallOpening
from app.models.panelization_result import PanelizationResult, PanelInstance
from app.core.sip_constants import MIN_PANEL_WIDTH


@dataclass
class Opening:
    """Represents a wall opening for the panelization algorithm."""
    opening_type: str  # door, window
    x: float  # position from wall start (mm)
    y: float  # position from wall bottom (mm)
    width: float  # mm
    height: float  # mm
    rough_width: float = 0.0
    rough_height: float = 0.0


@dataclass
class PanelData:
    """Output of the panelization algorithm."""
    sequence_order: int = 0
    position_x_mm: float = 0.0
    position_y_mm: float = 0.0
    width_mm: float = 0.0
    height_mm: float = 0.0
    is_custom_cut: bool = False
    has_opening: bool = False
    opening_type: str | None = None
    opening_x_mm: float | None = None
    opening_y_mm: float | None = None
    opening_width_mm: float | None = None
    opening_height_mm: float | None = None
    panel_type: str = "full"
    weight_kg: float = 0.0
    area_m2: float = 0.0


def panelize_wall(
    wall_length_mm: float,
    wall_height_mm: float,
    openings: list[Opening],
    standard_width_mm: float = 1220.0,
    standard_height_mm: float = 2440.0,
    min_panel_width_mm: float = 200.0,
    skin_thickness_mm: float = 11.0,
    skin_density: float = 640.0,
    core_thickness_mm: float = 114.0,
    core_density: float = 20.0,
) -> list[PanelData]:
    """
    Pure function: divide a wall into SIP panels.

    Algorithm:
    1. Build list of "zones" along the wall X-axis: free zones and opening zones
    2. Fill free zones with standard-width panels, last one custom-cut if needed
    3. For opening zones: create panels around the opening (above, below, sides)
    4. Calculate weight and area for each panel
    """
    if wall_length_mm <= 0 or wall_height_mm <= 0:
        return []

    panel_height = min(wall_height_mm, standard_height_mm)

    # Sort openings by X position
    sorted_openings = sorted(openings, key=lambda o: o.x)

    # Build zones: list of (start_x, end_x, opening_or_none)
    zones: list[tuple[float, float, Opening | None]] = []
    current_x = 0.0

    for op in sorted_openings:
        op_start = op.x
        op_end = op.x + op.rough_width

        # Free zone before this opening
        if op_start > current_x:
            zones.append((current_x, op_start, None))

        # Opening zone
        zones.append((op_start, op_end, op))
        current_x = op_end

    # Free zone after last opening
    if current_x < wall_length_mm:
        zones.append((current_x, wall_length_mm, None))

    # Generate panels for each zone
    panels: list[PanelData] = []
    sequence = 0

    for zone_start, zone_end, opening in zones:
        zone_width = zone_end - zone_start

        if opening is None:
            # Free zone: fill with standard panels
            new_panels = _fill_free_zone(
                zone_start, zone_width, panel_height,
                standard_width_mm, min_panel_width_mm, sequence
            )
            panels.extend(new_panels)
            sequence += len(new_panels)
        else:
            # Opening zone: create panels around the opening
            new_panels = _create_opening_panels(
                zone_start, zone_width, wall_height_mm, panel_height,
                opening, standard_width_mm, min_panel_width_mm, sequence
            )
            panels.extend(new_panels)
            sequence += len(new_panels)

    # Calculate weight and area for each panel
    for panel in panels:
        _calculate_panel_properties(
            panel, skin_thickness_mm, skin_density,
            core_thickness_mm, core_density
        )

    return panels


def _fill_free_zone(
    start_x: float, zone_width: float, panel_height: float,
    standard_width: float, min_width: float, start_sequence: int
) -> list[PanelData]:
    """Fill a free zone (no openings) with standard-width panels."""
    panels = []
    x = start_x
    remaining = zone_width
    seq = start_sequence

    while remaining > 0:
        if remaining <= standard_width:
            # Last panel in zone
            width = remaining
            is_custom = abs(width - standard_width) > 1.0  # 1mm tolerance
            # If too narrow, merge with previous panel
            if width < min_width and panels:
                prev = panels[-1]
                prev.width_mm += width
                prev.is_custom_cut = True
                break
            panels.append(PanelData(
                sequence_order=seq,
                position_x_mm=x,
                position_y_mm=0.0,
                width_mm=width,
                height_mm=panel_height,
                is_custom_cut=is_custom,
                panel_type="full" if not is_custom else "filler",
            ))
            seq += 1
            break
        else:
            # Check if the remainder after this panel would be too small
            next_remaining = remaining - standard_width
            if 0 < next_remaining < min_width:
                # Split evenly into two panels instead
                half = remaining / 2
                panels.append(PanelData(
                    sequence_order=seq,
                    position_x_mm=x,
                    width_mm=half,
                    height_mm=panel_height,
                    is_custom_cut=True,
                    panel_type="full",
                ))
                seq += 1
                panels.append(PanelData(
                    sequence_order=seq,
                    position_x_mm=x + half,
                    width_mm=half,
                    height_mm=panel_height,
                    is_custom_cut=True,
                    panel_type="full",
                ))
                seq += 1
                break

            panels.append(PanelData(
                sequence_order=seq,
                position_x_mm=x,
                width_mm=standard_width,
                height_mm=panel_height,
                panel_type="full",
            ))
            seq += 1
            x += standard_width
            remaining -= standard_width

    return panels


def _create_opening_panels(
    zone_start: float, zone_width: float,
    wall_height: float, panel_height: float,
    opening: Opening,
    standard_width: float, min_width: float, start_sequence: int,
) -> list[PanelData]:
    """Create panels around a door or window opening."""
    panels = []
    seq = start_sequence

    op_left = opening.x - zone_start  # relative position within zone
    op_bottom = opening.y
    op_top = opening.y + opening.rough_height
    op_right = op_left + opening.rough_width

    # Header panel (above the opening)
    header_height = panel_height - op_top
    if header_height > min_width:
        panels.append(PanelData(
            sequence_order=seq,
            position_x_mm=zone_start + op_left,
            position_y_mm=op_top,
            width_mm=opening.rough_width,
            height_mm=header_height,
            is_custom_cut=True,
            panel_type="header",
        ))
        seq += 1

    # Sill panel (below the opening, only for windows)
    if opening.opening_type == "window" and op_bottom > min_width:
        panels.append(PanelData(
            sequence_order=seq,
            position_x_mm=zone_start + op_left,
            position_y_mm=0.0,
            width_mm=opening.rough_width,
            height_mm=op_bottom,
            is_custom_cut=True,
            panel_type="sill",
        ))
        seq += 1

    # Mark the opening zone itself (for tracking - this isn't a physical panel)
    # Instead, we create a panel that contains the opening
    opening_panel = PanelData(
        sequence_order=seq,
        position_x_mm=zone_start,
        position_y_mm=0.0,
        width_mm=zone_width,
        height_mm=panel_height,
        is_custom_cut=True,
        has_opening=True,
        opening_type=opening.opening_type,
        opening_x_mm=op_left,
        opening_y_mm=opening.y,
        opening_width_mm=opening.rough_width,
        opening_height_mm=opening.rough_height,
        panel_type="full",
    )
    panels.append(opening_panel)
    seq += 1

    return panels


def _calculate_panel_properties(
    panel: PanelData,
    skin_thickness_mm: float, skin_density: float,
    core_thickness_mm: float, core_density: float,
):
    """Calculate weight and area for a panel."""
    gross_area = (panel.width_mm * panel.height_mm) / 1e6  # m2

    # Subtract opening area if present
    opening_area = 0.0
    if panel.has_opening and panel.opening_width_mm and panel.opening_height_mm:
        opening_area = (panel.opening_width_mm * panel.opening_height_mm) / 1e6

    net_area = gross_area - opening_area
    panel.area_m2 = max(0, net_area)

    # Weight = 2 skins + 1 core
    skin_weight = 2 * (panel.area_m2 * (skin_thickness_mm / 1000) * skin_density)
    core_weight = panel.area_m2 * (core_thickness_mm / 1000) * core_density
    panel.weight_kg = round(skin_weight + core_weight, 2)


class SipPanelizationService:
    """High-level service that orchestrates SIP panelization with DB persistence."""

    def __init__(self, db: Session):
        self.db = db

    def panelize_wall(
        self,
        project_id: int,
        ifc_element_id: int,
        sip_config_id: int,
        wall_prefix: str | None = None,
    ) -> PanelizationResult:
        """Panelize a single wall element using a SIP configuration."""
        # Fetch element
        element = self.db.query(IfcElement).filter(IfcElement.id == ifc_element_id).first()
        if not element:
            raise ValueError(f"IFC Element {ifc_element_id} not found")

        # Fetch config
        config = self.db.query(SipPanelConfig).filter(SipPanelConfig.id == sip_config_id).first()
        if not config:
            raise ValueError(f"SIP Config {sip_config_id} not found")

        # Get material properties
        core_material = self.db.query(Material).filter(Material.id == config.core_material_id).first()
        skin_material = self.db.query(Material).filter(Material.id == config.skin_material_id).first()
        if not core_material or not skin_material:
            raise ValueError("Core or skin material not found")

        # Delete existing panelization for this wall
        existing = (
            self.db.query(PanelizationResult)
            .filter(
                PanelizationResult.project_id == project_id,
                PanelizationResult.ifc_element_id == ifc_element_id,
            )
            .first()
        )
        if existing:
            self.db.delete(existing)
            self.db.flush()

        # Get wall dimensions
        wall_length_mm = (element.length_m or 0) * 1000
        wall_height_mm = (element.height_m or 0) * 1000

        if wall_length_mm <= 0 or wall_height_mm <= 0:
            raise ValueError(f"Wall has invalid dimensions: {wall_length_mm}x{wall_height_mm}mm")

        # Get openings
        db_openings = (
            self.db.query(WallOpening)
            .filter(WallOpening.ifc_element_id == ifc_element_id)
            .order_by(WallOpening.position_x_mm)
            .all()
        )

        openings = [
            Opening(
                opening_type=o.opening_type,
                x=o.position_x_mm,
                y=o.position_y_mm,
                width=o.width_mm,
                height=o.height_mm,
                rough_width=o.rough_opening_width_mm,
                rough_height=o.rough_opening_height_mm,
            )
            for o in db_openings
        ]

        # Run panelization algorithm
        panel_data_list = panelize_wall(
            wall_length_mm=wall_length_mm,
            wall_height_mm=wall_height_mm,
            openings=openings,
            standard_width_mm=config.standard_width_mm,
            standard_height_mm=config.standard_height_mm,
            min_panel_width_mm=config.min_panel_width_mm,
            skin_thickness_mm=config.skin_thickness_mm,
            skin_density=skin_material.density_kg_m3 or 640,
            core_thickness_mm=config.core_thickness_mm,
            core_density=core_material.density_kg_m3 or 20,
        )

        # Create result record
        result = PanelizationResult(
            project_id=project_id,
            ifc_element_id=ifc_element_id,
            config_type="sip",
            sip_config_id=sip_config_id,
            status="draft",
        )
        self.db.add(result)
        self.db.flush()

        # Generate label prefix
        prefix = wall_prefix or self._generate_wall_prefix(project_id)

        # Create panel instances
        for i, pd in enumerate(panel_data_list):
            suffix = chr(65 + i) if i < 26 else f"{i + 1}"  # A, B, C... or 1, 2, 3...
            label = f"{prefix}-{suffix}"

            instance = PanelInstance(
                panelization_result_id=result.id,
                panel_label=label,
                sequence_order=pd.sequence_order,
                position_x_mm=pd.position_x_mm,
                position_y_mm=pd.position_y_mm,
                width_mm=pd.width_mm,
                height_mm=pd.height_mm,
                is_custom_cut=pd.is_custom_cut,
                has_opening=pd.has_opening,
                opening_type=pd.opening_type,
                opening_x_mm=pd.opening_x_mm,
                opening_y_mm=pd.opening_y_mm,
                opening_width_mm=pd.opening_width_mm,
                opening_height_mm=pd.opening_height_mm,
                panel_type=pd.panel_type,
                weight_kg=pd.weight_kg,
                area_m2=pd.area_m2,
            )
            self.db.add(instance)

        self.db.commit()
        return result

    def bulk_panelize(
        self,
        project_id: int,
        model_id: int,
        sip_config_id: int,
        storey_filter: str | None = None,
    ) -> list[PanelizationResult]:
        """Panelize all walls in a model (or a specific storey)."""
        query = (
            self.db.query(IfcElement)
            .filter(IfcElement.ifc_model_id == model_id)
            .filter(IfcElement.ifc_type.in_(["IfcWall", "IfcWallStandardCase"]))
        )
        if storey_filter:
            query = query.filter(IfcElement.storey_name == storey_filter)

        walls = query.all()
        results = []

        for wall in walls:
            try:
                result = self.panelize_wall(
                    project_id=project_id,
                    ifc_element_id=wall.id,
                    sip_config_id=sip_config_id,
                )
                results.append(result)
            except (ValueError, Exception):
                continue

        return results

    def get_result(self, project_id: int, ifc_element_id: int) -> PanelizationResult | None:
        """Get panelization result for a wall."""
        return (
            self.db.query(PanelizationResult)
            .filter(
                PanelizationResult.project_id == project_id,
                PanelizationResult.ifc_element_id == ifc_element_id,
            )
            .first()
        )

    def get_all_results(self, project_id: int) -> list[dict]:
        """Get all panelization results for a project with summary info."""
        results = (
            self.db.query(PanelizationResult)
            .filter(PanelizationResult.project_id == project_id)
            .order_by(PanelizationResult.created_at)
            .all()
        )

        output = []
        for r in results:
            element = self.db.query(IfcElement).filter(IfcElement.id == r.ifc_element_id).first()
            instances = r.panel_instances

            output.append({
                "id": r.id,
                "project_id": r.project_id,
                "ifc_element_id": r.ifc_element_id,
                "config_type": r.config_type,
                "sip_config_id": r.sip_config_id,
                "status": r.status,
                "wall_name": element.name if element else None,
                "wall_length_mm": (element.length_m or 0) * 1000 if element else None,
                "wall_height_mm": (element.height_m or 0) * 1000 if element else None,
                "storey": element.storey_name if element else None,
                "panel_count": len(instances),
                "total_area_m2": round(sum(p.area_m2 for p in instances), 2),
                "total_weight_kg": round(sum(p.weight_kg for p in instances), 2),
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            })

        return output

    def get_instances(self, result_id: int) -> list[PanelInstance]:
        """Get all panel instances for a panelization result."""
        result = self.db.query(PanelizationResult).filter(PanelizationResult.id == result_id).first()
        if not result:
            return []
        return result.panel_instances

    def delete_result(self, result_id: int) -> bool:
        """Delete a panelization result and all its panel instances."""
        result = self.db.query(PanelizationResult).filter(PanelizationResult.id == result_id).first()
        if not result:
            return False
        self.db.delete(result)
        self.db.commit()
        return True

    def confirm_result(self, result_id: int) -> PanelizationResult | None:
        """Confirm a panelization result (mark as final)."""
        result = self.db.query(PanelizationResult).filter(PanelizationResult.id == result_id).first()
        if not result:
            return None
        result.status = "confirmed"
        self.db.commit()
        return result

    def _generate_wall_prefix(self, project_id: int) -> str:
        """Generate next wall prefix like SIP-001, SIP-002, etc."""
        count = (
            self.db.query(PanelizationResult)
            .filter(
                PanelizationResult.project_id == project_id,
                PanelizationResult.config_type == "sip",
            )
            .count()
        )
        return f"SIP-{count + 1:03d}"
