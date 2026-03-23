"""Service for modular BIM construction - auto-grouping, storeys, connections."""

import math

from sqlalchemy.orm import Session

from app.models.bim_panel import BimPanel
from app.models.bim_storey import BimStorey
from app.models.wall_group import WallGroup

# Tolerance for considering panels as adjacent (mm)
ADJACENCY_TOLERANCE = 50.0


class BimModularService:
    def __init__(self, db: Session):
        self.db = db

    # ── Storey management ──

    def ensure_default_storey(self, project_id: int) -> BimStorey:
        """Create default ground-floor storey if none exists."""
        existing = (
            self.db.query(BimStorey)
            .filter(BimStorey.project_id == project_id)
            .first()
        )
        if existing:
            return existing

        storey = BimStorey(
            project_id=project_id,
            name="Piso 1",
            level_index=0,
            elevation_mm=0.0,
            floor_height_mm=2440.0,
        )
        self.db.add(storey)
        self.db.commit()
        self.db.refresh(storey)
        return storey

    def list_storeys(self, project_id: int) -> list[BimStorey]:
        self.ensure_default_storey(project_id)
        return (
            self.db.query(BimStorey)
            .filter(BimStorey.project_id == project_id)
            .order_by(BimStorey.level_index)
            .all()
        )

    def add_storey(self, project_id: int, name: str, elevation_mm: float, floor_height_mm: float = 2440.0) -> BimStorey:
        max_index = (
            self.db.query(BimStorey.level_index)
            .filter(BimStorey.project_id == project_id)
            .order_by(BimStorey.level_index.desc())
            .first()
        )
        new_index = (max_index[0] + 1) if max_index else 0

        storey = BimStorey(
            project_id=project_id,
            name=name,
            level_index=new_index,
            elevation_mm=elevation_mm,
            floor_height_mm=floor_height_mm,
        )
        self.db.add(storey)
        self.db.commit()
        self.db.refresh(storey)
        return storey

    def delete_storey(self, storey_id: int):
        storey = self.db.query(BimStorey).filter(BimStorey.id == storey_id).first()
        if not storey:
            raise ValueError("Storey not found")
        # Unlink panels from this storey
        self.db.query(BimPanel).filter(BimPanel.storey_id == storey_id).update(
            {"storey_id": None}, synchronize_session="fetch"
        )
        self.db.delete(storey)
        self.db.commit()

    # ── Wall auto-grouping ──

    def auto_group_walls(self, project_id: int) -> list[dict]:
        """Detect adjacent colinear panels and group them into walls."""
        panels = (
            self.db.query(BimPanel)
            .filter(
                BimPanel.project_id == project_id,
                BimPanel.orientation == "wall",
            )
            .order_by(BimPanel.pos_x_mm, BimPanel.pos_z_mm)
            .all()
        )

        if not panels:
            return []

        # Clear existing wall groups
        self.db.query(WallGroup).filter(WallGroup.project_id == project_id).delete()
        for p in panels:
            p.wall_group_id = None
        self.db.flush()

        # Group panels by rotation angle (colinear panels have same rotation)
        assigned = set()
        groups = []

        for panel in panels:
            if panel.id in assigned:
                continue

            # Find all panels colinear with this one
            group_panels = [panel]
            assigned.add(panel.id)

            for other in panels:
                if other.id in assigned:
                    continue
                if self._are_colinear_adjacent(panel, other, group_panels):
                    group_panels.append(other)
                    assigned.add(other.id)

            # Only create group if 1+ panels (single panels are also a wall)
            groups.append(group_panels)

        # Create WallGroup records
        result = []
        for i, group_panels in enumerate(groups):
            wall_name = f"Muro {chr(65 + i)}" if i < 26 else f"Muro {i + 1}"
            total_length = sum(p.width_mm for p in group_panels)

            wall_group = WallGroup(
                project_id=project_id,
                name=wall_name,
                storey_id=group_panels[0].storey_id,
                axis_angle_deg=group_panels[0].rotation_deg,
                total_length_mm=total_length,
                panel_count=len(group_panels),
            )
            self.db.add(wall_group)
            self.db.flush()

            for p in group_panels:
                p.wall_group_id = wall_group.id

            result.append({
                "id": wall_group.id,
                "name": wall_name,
                "panel_count": len(group_panels),
                "total_length_mm": total_length,
                "panels": [p.label for p in group_panels],
            })

        self.db.commit()
        return result

    def _are_colinear_adjacent(self, ref: BimPanel, candidate: BimPanel, group: list[BimPanel]) -> bool:
        """Check if candidate is colinear and adjacent to any panel in the group."""
        # Must have same rotation (within tolerance)
        if abs(ref.rotation_deg - candidate.rotation_deg) > 1.0:
            return False

        # Must be at same Y level (same storey)
        if abs(ref.pos_y_mm - candidate.pos_y_mm) > ADJACENCY_TOLERANCE:
            return False

        rad = math.radians(ref.rotation_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)

        # Check if candidate is on the same line (perpendicular distance ≈ 0)
        # and adjacent to any panel in the group
        for gp in group:
            # Vector from gp to candidate
            dx = candidate.pos_x_mm - gp.pos_x_mm
            dz = candidate.pos_z_mm - gp.pos_z_mm

            # Perpendicular distance to the wall line
            perp_dist = abs(-sin_a * dx + cos_a * dz)
            if perp_dist > ADJACENCY_TOLERANCE:
                continue

            # Parallel distance along the wall
            par_dist = cos_a * dx + sin_a * dz

            # Check if adjacent (touching at edge)
            # candidate starts at gp end, or gp starts at candidate end
            if abs(par_dist - gp.width_mm) < ADJACENCY_TOLERANCE:
                return True
            if abs(par_dist + candidate.width_mm) < ADJACENCY_TOLERANCE:
                return True

        return False

    # ── Connection analysis ──

    def get_connections(self, project_id: int) -> list[dict]:
        """Find all panel-to-panel connections (edges that touch)."""
        panels = (
            self.db.query(BimPanel)
            .filter(BimPanel.project_id == project_id)
            .all()
        )

        connections = []
        for i, p1 in enumerate(panels):
            for p2 in panels[i + 1:]:
                conn = self._detect_connection(p1, p2)
                if conn:
                    connections.append(conn)

        return connections

    def _detect_connection(self, p1: BimPanel, p2: BimPanel) -> dict | None:
        """Detect if two panels share an edge or corner."""
        # Get edge points for each panel
        edges1 = self._get_panel_edges(p1)
        edges2 = self._get_panel_edges(p2)

        # Check for edge-to-edge contact
        for e1_name, e1_start, e1_end in edges1:
            for e2_name, e2_start, e2_end in edges2:
                if self._edges_touch(e1_start, e1_end, e2_start, e2_end):
                    # Determine connection type
                    angle_diff = abs(p1.rotation_deg - p2.rotation_deg) % 180
                    if angle_diff < 5:
                        conn_type = "inline"  # Same wall line (spline joint)
                    elif abs(angle_diff - 90) < 5:
                        conn_type = "corner"  # 90-degree corner
                    else:
                        conn_type = "angled"

                    mid_x = (e1_start[0] + e1_end[0] + e2_start[0] + e2_end[0]) / 4
                    mid_y = (p1.pos_y_mm + p2.pos_y_mm) / 2
                    mid_z = (e1_start[1] + e1_end[1] + e2_start[1] + e2_end[1]) / 4

                    return {
                        "panel_a_id": p1.id,
                        "panel_a_label": p1.label,
                        "panel_b_id": p2.id,
                        "panel_b_label": p2.label,
                        "type": conn_type,
                        "pos_x_mm": mid_x,
                        "pos_y_mm": mid_y,
                        "pos_z_mm": mid_z,
                    }
        return None

    def _get_panel_edges(self, panel: BimPanel) -> list[tuple]:
        """Get the 4 edges of a panel as (name, start_xz, end_xz)."""
        rad = math.radians(panel.rotation_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)

        x, z = panel.pos_x_mm, panel.pos_z_mm
        w, d = panel.width_mm, panel.thickness_mm

        # Four corners (in XZ plane)
        corners = [
            (x, z),  # origin
            (x + cos_a * w, z + sin_a * w),  # along width
            (x + cos_a * w - sin_a * d, z + sin_a * w + cos_a * d),  # width + depth
            (x - sin_a * d, z + cos_a * d),  # along depth
        ]

        return [
            ("front", corners[0], corners[1]),
            ("right", corners[1], corners[2]),
            ("back", corners[2], corners[3]),
            ("left", corners[3], corners[0]),
        ]

    def _edges_touch(self, a_start, a_end, b_start, b_end) -> bool:
        """Check if two edges overlap or touch within tolerance."""
        # Check if any endpoint of one edge is close to the other edge
        for pt in [a_start, a_end]:
            if self._point_near_segment(pt, b_start, b_end):
                return True
        for pt in [b_start, b_end]:
            if self._point_near_segment(pt, a_start, a_end):
                return True
        return False

    def _point_near_segment(self, pt, seg_start, seg_end) -> bool:
        """Check if a point is within tolerance of a line segment."""
        dx = seg_end[0] - seg_start[0]
        dz = seg_end[1] - seg_start[1]
        seg_len_sq = dx * dx + dz * dz

        if seg_len_sq < 0.001:
            dist = math.sqrt((pt[0] - seg_start[0]) ** 2 + (pt[1] - seg_start[1]) ** 2)
            return dist < ADJACENCY_TOLERANCE

        t = max(0, min(1, ((pt[0] - seg_start[0]) * dx + (pt[1] - seg_start[1]) * dz) / seg_len_sq))
        proj_x = seg_start[0] + t * dx
        proj_z = seg_start[1] + t * dz
        dist = math.sqrt((pt[0] - proj_x) ** 2 + (pt[1] - proj_z) ** 2)
        return dist < ADJACENCY_TOLERANCE

    # ── Summary with modular info ──

    def get_modular_summary(self, project_id: int) -> dict:
        """Extended summary with wall groups, storeys, and connections."""
        panels = self.db.query(BimPanel).filter(BimPanel.project_id == project_id).all()
        storeys = self.list_storeys(project_id)
        wall_groups = self.db.query(WallGroup).filter(WallGroup.project_id == project_id).all()
        connections = self.get_connections(project_id)

        wall_panels = [p for p in panels if p.orientation == "wall"]
        floor_panels = [p for p in panels if p.orientation == "floor"]
        roof_panels = [p for p in panels if p.orientation == "roof"]

        def calc_area(panel_list):
            return round(sum((p.width_mm / 1000) * (p.height_mm / 1000) for p in panel_list), 2)

        def calc_weight(panel_list):
            return round(sum(
                (p.width_mm / 1000) * (p.height_mm / 1000) * (2 * 0.011 * 640 + 0.114 * 20)
                for p in panel_list
            ), 1)

        return {
            "total_panels": len(panels),
            "wall_panels": len(wall_panels),
            "floor_panels": len(floor_panels),
            "roof_panels": len(roof_panels),
            "wall_area_m2": calc_area(wall_panels),
            "floor_area_m2": calc_area(floor_panels),
            "roof_area_m2": calc_area(roof_panels),
            "total_weight_kg": calc_weight(panels),
            "wall_groups": len(wall_groups),
            "connections": len(connections),
            "storeys": [{"id": s.id, "name": s.name, "elevation_mm": s.elevation_mm} for s in storeys],
            "by_storey": self._panels_by_storey(panels, storeys),
        }

    def _panels_by_storey(self, panels, storeys):
        storey_map = {s.id: s.name for s in storeys}
        result = {}
        for p in panels:
            name = storey_map.get(p.storey_id, p.storey_name or "Sin piso")
            result[name] = result.get(name, 0) + 1
        return result
