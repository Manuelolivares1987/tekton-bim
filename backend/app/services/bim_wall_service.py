"""BimWall service - orchestrates wall creation, panelization, and framing.

The core workflow:
1. User draws a wall (P1, P2)
2. Service computes geometry (length, rotation)
3. Service calls panelize_wall() to generate SIP panels
4. Service calls generate_framing() for each panel
5. Everything is returned as a wall assembly
"""

import math
from sqlalchemy.orm import Session

from app.models.bim_wall import BimWall
from app.models.bim_wall_opening import BimWallOpening
from app.models.bim_panel import BimPanel
from app.models.bim_storey import BimStorey
from app.services.sip_panelization_service import panelize_wall, Opening, PanelData
from app.services.wood_frame_service import generate_framing, MemberData


class BimWallService:
    def __init__(self, db: Session):
        self.db = db

    def draw_wall(
        self,
        project_id: int,
        start_x_mm: float,
        start_z_mm: float,
        end_x_mm: float,
        end_z_mm: float,
        storey_id: int | None = None,
        height_mm: float = 2440.0,
        thickness_mm: float = 136.0,
        standard_panel_width_mm: float = 1220.0,
        stud_spacing_mm: float = 400.0,
        joint_type: str = "tablilla_osb",
        plate_count_top: int = 2,
        plate_count_bottom: int = 1,
        max_lumber_length_mm: float = 3200.0,
    ) -> dict:
        """Draw a wall from P1 to P2. Auto-generates panels and framing."""
        count = self.db.query(BimWall).filter(BimWall.project_id == project_id).count()
        label = f"W-{count + 1:03d}"

        wall = BimWall(
            project_id=project_id,
            storey_id=storey_id,
            label=label,
            start_x_mm=start_x_mm,
            start_z_mm=start_z_mm,
            end_x_mm=end_x_mm,
            end_z_mm=end_z_mm,
            height_mm=height_mm,
            thickness_mm=thickness_mm,
            standard_panel_width_mm=standard_panel_width_mm,
            stud_spacing_mm=stud_spacing_mm,
            joint_type=joint_type,
            plate_count_top=plate_count_top,
            plate_count_bottom=plate_count_bottom,
            max_lumber_length_mm=max_lumber_length_mm,
        )
        wall.compute_geometry()

        self.db.add(wall)
        self.db.flush()

        # Generate panels
        self._regenerate_panels(wall)
        self.db.commit()
        self.db.refresh(wall)

        return self.get_wall_assembly(wall.id)

    def update_wall(self, wall_id: int, **kwargs) -> dict:
        """Update wall properties and regenerate panels."""
        wall = self.db.query(BimWall).filter(BimWall.id == wall_id).first()
        if not wall:
            raise ValueError("Wall not found")

        for key, value in kwargs.items():
            if hasattr(wall, key) and value is not None:
                setattr(wall, key, value)

        # Recompute if endpoints changed
        if any(k in kwargs for k in ("start_x_mm", "start_z_mm", "end_x_mm", "end_z_mm")):
            wall.compute_geometry()

        self._regenerate_panels(wall)
        self.db.commit()
        return self.get_wall_assembly(wall.id)

    def delete_wall(self, wall_id: int):
        """Delete wall and all children (panels cascade)."""
        wall = self.db.query(BimWall).filter(BimWall.id == wall_id).first()
        if not wall:
            raise ValueError("Wall not found")
        self.db.delete(wall)
        self.db.commit()

    def add_opening(
        self,
        wall_id: int,
        opening_type: str,
        position_along_mm: float,
        position_y_mm: float,
        width_mm: float,
        height_mm: float,
    ) -> dict:
        """Add an opening to a wall and regenerate panels."""
        wall = self.db.query(BimWall).filter(BimWall.id == wall_id).first()
        if not wall:
            raise ValueError("Wall not found")

        # Auto-label
        count = len(wall.openings)
        prefix = "P" if opening_type == "door" else "V"
        label = f"{prefix}-{count + 1:02d}"

        opening = BimWallOpening(
            wall_id=wall_id,
            opening_type=opening_type,
            label=label,
            position_along_mm=position_along_mm,
            position_y_mm=position_y_mm,
            width_mm=width_mm,
            height_mm=height_mm,
        )
        self.db.add(opening)
        self.db.flush()
        self.db.refresh(wall)  # reload openings relationship

        self._regenerate_panels(wall)
        self.db.commit()
        return self.get_wall_assembly(wall.id)

    def remove_opening(self, wall_id: int, opening_id: int) -> dict:
        """Remove an opening and regenerate panels."""
        opening = self.db.query(BimWallOpening).filter(
            BimWallOpening.id == opening_id,
            BimWallOpening.wall_id == wall_id,
        ).first()
        if not opening:
            raise ValueError("Opening not found")

        wall = opening.wall
        self.db.delete(opening)
        self.db.flush()
        self.db.refresh(wall)

        self._regenerate_panels(wall)
        self.db.commit()
        return self.get_wall_assembly(wall.id)

    def get_wall_assembly(self, wall_id: int) -> dict:
        """Get complete wall assembly: wall + panels + framing + openings.

        SIP construction assembly:
        - Solera inferior: CONTINUOUS pine plate along full wall (NOT per-panel)
        - Solera superior: CONTINUOUS double pine plate along full wall
        - Tablillas OSB: splines at panel-to-panel inline joints (NOT studs)
        - Pie derechos: ONLY at wall ends, corners, and T-junctions
        - Framing around openings: king studs, jack studs, header, sill, cripples
        """
        wall = self.db.query(BimWall).filter(BimWall.id == wall_id).first()
        if not wall:
            raise ValueError("Wall not found")

        panels = (
            self.db.query(BimPanel)
            .filter(BimPanel.wall_id == wall_id)
            .order_by(BimPanel.pos_x_mm)
            .all()
        )

        framing = []
        rad = math.radians(wall.rotation_deg or 0)
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)
        STUD_W = wall.stud_width_mm  # 38mm
        STUD_D = wall.stud_depth_mm  # 89mm
        MAX_LUMBER_MM = wall.max_lumber_length_mm or 3200.0
        JOINT_TYPE = wall.joint_type or "tablilla_osb"

        # ── CONTINUOUS SOLERA INFERIOR (bottom plate) ──
        # Runs full wall length, spliced at MAX_LUMBER_MM if wall is longer
        remaining = wall.length_mm
        offset = 0.0
        while remaining > 0:
            seg_len = min(remaining, MAX_LUMBER_MM)
            framing.append({
                "member_type": "bottom_plate",
                "position_x_mm": offset,
                "position_y_mm": 0,
                "length_mm": seg_len,
                "width_mm": STUD_W,
                "depth_mm": STUD_D,
                "lumber_size": wall.lumber_size,
                "quantity": 1,
                "panel_id": None,
                "panel_label": wall.label,
                "world_x_mm": wall.start_x_mm + cos_r * offset,
                "world_y_mm": panels[0].pos_y_mm if panels else 0,
                "world_z_mm": wall.start_z_mm + sin_r * offset,
                "panel_rotation_deg": wall.rotation_deg,
            })
            offset += seg_len
            remaining -= seg_len

        # ── CONTINUOUS SOLERA SUPERIOR (top plates - double) ──
        for plate_i in range(wall.plate_count_top):
            remaining = wall.length_mm
            offset = 0.0
            # Offset splice joints from bottom plate (stagger by 400mm per plate)
            splice_offset = plate_i * 400.0
            if splice_offset > 0:
                first_seg = min(splice_offset, remaining)
                y_pos = wall.height_mm - STUD_W * (wall.plate_count_top - plate_i)
                framing.append({
                    "member_type": "top_plate",
                    "position_x_mm": 0,
                    "position_y_mm": y_pos,
                    "length_mm": first_seg,
                    "width_mm": STUD_W,
                    "depth_mm": STUD_D,
                    "lumber_size": wall.lumber_size,
                    "quantity": 1,
                    "panel_id": None,
                    "panel_label": wall.label,
                    "world_x_mm": wall.start_x_mm,
                    "world_y_mm": panels[0].pos_y_mm if panels else 0,
                    "world_z_mm": wall.start_z_mm,
                    "panel_rotation_deg": wall.rotation_deg,
                })
                offset = first_seg
                remaining -= first_seg

            while remaining > 0:
                seg_len = min(remaining, MAX_LUMBER_MM)
                y_pos = wall.height_mm - STUD_W * (wall.plate_count_top - plate_i)
                framing.append({
                    "member_type": "top_plate",
                    "position_x_mm": offset,
                    "position_y_mm": y_pos,
                    "length_mm": seg_len,
                    "width_mm": STUD_W,
                    "depth_mm": STUD_D,
                    "lumber_size": wall.lumber_size,
                    "quantity": 1,
                    "panel_id": None,
                    "panel_label": wall.label,
                    "world_x_mm": wall.start_x_mm + cos_r * offset,
                    "world_y_mm": panels[0].pos_y_mm if panels else 0,
                    "world_z_mm": wall.start_z_mm + sin_r * offset,
                    "panel_rotation_deg": wall.rotation_deg,
                })
                offset += seg_len
                remaining -= seg_len

        # ── PIE DERECHOS at wall ends only ──
        plate_zone = STUD_W * (wall.plate_count_top + wall.plate_count_bottom)
        stud_height = wall.height_mm - plate_zone
        if stud_height > 0:
            for end_offset in [0.0, wall.length_mm - STUD_W]:
                if end_offset < 0:
                    end_offset = 0
                framing.append({
                    "member_type": "stud",
                    "position_x_mm": end_offset,
                    "position_y_mm": STUD_W * wall.plate_count_bottom,
                    "length_mm": stud_height,
                    "width_mm": STUD_W,
                    "depth_mm": STUD_D,
                    "lumber_size": wall.lumber_size,
                    "quantity": 1,
                    "panel_id": None,
                    "panel_label": wall.label,
                    "world_x_mm": wall.start_x_mm + cos_r * end_offset,
                    "world_y_mm": panels[0].pos_y_mm if panels else 0,
                    "world_z_mm": wall.start_z_mm + sin_r * end_offset,
                    "panel_rotation_deg": wall.rotation_deg,
                })

        # ── PANEL-TO-PANEL JOINTS ──
        sorted_panels = sorted(panels, key=lambda p: (p.pos_x_mm, p.pos_z_mm))
        for i in range(len(sorted_panels) - 1):
            p1 = sorted_panels[i]
            p2 = sorted_panels[i + 1]
            p1_end_x = p1.pos_x_mm + cos_r * p1.width_mm
            p1_end_z = p1.pos_z_mm + sin_r * p1.width_mm
            dist = math.sqrt((p2.pos_x_mm - p1_end_x) ** 2 + (p2.pos_z_mm - p1_end_z) ** 2)
            if dist < 50:  # adjacent panels
                panel_offset = sum(pp.width_mm for pp in sorted_panels[:i + 1])

                if JOINT_TYPE == "lumber_spline":
                    # Single shared pie derecho between panels
                    framing.append({
                        "member_type": "connection_stud",
                        "position_x_mm": panel_offset - STUD_W / 2,
                        "position_y_mm": STUD_W * wall.plate_count_bottom,
                        "length_mm": stud_height,
                        "width_mm": STUD_W,
                        "depth_mm": STUD_D,
                        "lumber_size": wall.lumber_size,
                        "quantity": 1,
                        "panel_id": p1.id,
                        "panel_label": f"{p1.label}|{p2.label}",
                        "world_x_mm": wall.start_x_mm + cos_r * panel_offset,
                        "world_y_mm": p1.pos_y_mm,
                        "world_z_mm": wall.start_z_mm + sin_r * panel_offset,
                        "panel_rotation_deg": wall.rotation_deg,
                    })
                elif JOINT_TYPE == "double_stud":
                    # Double pie derecho (one per panel at the joint)
                    for stud_off in [panel_offset - STUD_W, panel_offset]:
                        framing.append({
                            "member_type": "connection_stud",
                            "position_x_mm": stud_off,
                            "position_y_mm": STUD_W * wall.plate_count_bottom,
                            "length_mm": stud_height,
                            "width_mm": STUD_W,
                            "depth_mm": STUD_D,
                            "lumber_size": wall.lumber_size,
                            "quantity": 1,
                            "panel_id": p1.id,
                            "panel_label": f"{p1.label}|{p2.label}",
                            "world_x_mm": wall.start_x_mm + cos_r * stud_off,
                            "world_y_mm": p1.pos_y_mm,
                            "world_z_mm": wall.start_z_mm + sin_r * stud_off,
                            "panel_rotation_deg": wall.rotation_deg,
                        })
                else:
                    # Tablillas OSB (2 splines per joint, 11.1mm x 100mm)
                    framing.append({
                        "member_type": "tablilla_osb",
                        "position_x_mm": panel_offset - 5.55,
                        "position_y_mm": STUD_W * wall.plate_count_bottom + 35,
                        "length_mm": wall.height_mm - plate_zone - 70,
                        "width_mm": 11.1,
                        "depth_mm": 100.0,
                        "lumber_size": "OSB 11.1",
                        "quantity": 2,
                        "panel_id": p1.id,
                        "panel_label": f"{p1.label}|{p2.label}",
                        "world_x_mm": wall.start_x_mm + cos_r * panel_offset,
                        "world_y_mm": p1.pos_y_mm,
                        "world_z_mm": wall.start_z_mm + sin_r * panel_offset,
                        "panel_rotation_deg": wall.rotation_deg,
                    })

        # ── FRAMING AROUND OPENINGS (per-panel, only for panels with openings) ──
        for panel in panels:
            if not panel.has_opening:
                continue
            members = generate_framing(
                panel_width_mm=panel.width_mm,
                panel_height_mm=panel.height_mm,
                stud_spacing_mm=wall.stud_spacing_mm,
                stud_width_mm=STUD_W,
                stud_depth_mm=STUD_D,
                lumber_size=wall.lumber_size,
                plate_count_top=0,  # plates handled at wall level
                plate_count_bottom=0,
                has_opening=True,
                opening_x_mm=panel.opening_x_mm or 0,
                opening_y_mm=panel.opening_y_mm or 0,
                opening_width_mm=panel.opening_width_mm or 0,
                opening_height_mm=panel.opening_height_mm or 0,
                opening_type=panel.opening_type,
            )
            # Only keep opening-specific members (not regular studs or plates)
            opening_member_types = {"king_stud", "jack_stud", "header", "sill_plate", "cripple_stud"}
            for m in members:
                if m.member_type not in opening_member_types:
                    continue
                framing.append({
                    "member_type": m.member_type,
                    "position_x_mm": m.position_x_mm,
                    "position_y_mm": m.position_y_mm,
                    "length_mm": m.length_mm,
                    "width_mm": m.width_mm,
                    "depth_mm": m.depth_mm,
                    "lumber_size": m.lumber_size,
                    "quantity": m.quantity,
                    "panel_id": panel.id,
                    "panel_label": panel.label,
                    "world_x_mm": panel.pos_x_mm,
                    "world_y_mm": panel.pos_y_mm,
                    "world_z_mm": panel.pos_z_mm,
                    "panel_rotation_deg": panel.rotation_deg,
                })

        return {
            "wall": _wall_to_dict(wall),
            "panels": [_panel_to_dict(p) for p in panels],
            "framing": framing,
            "openings": [_opening_to_dict(o) for o in wall.openings],
        }

    def list_walls(self, project_id: int) -> list[dict]:
        walls = (
            self.db.query(BimWall)
            .filter(BimWall.project_id == project_id)
            .order_by(BimWall.label)
            .all()
        )
        return [_wall_to_dict(w) for w in walls]

    def _regenerate_panels(self, wall: BimWall):
        """Delete old auto-generated panels and create new ones from panelization."""
        # Delete existing auto-generated panels for this wall
        self.db.query(BimPanel).filter(
            BimPanel.wall_id == wall.id,
            BimPanel.is_auto_generated == True,
        ).delete(synchronize_session="fetch")
        self.db.flush()

        if not wall.length_mm or wall.length_mm <= 0:
            wall.panel_count = 0
            return

        # Convert wall openings to panelization format
        from app.core.sip_constants import ROUGH_OPENING_CLEARANCE
        openings = []
        for wo in wall.openings:
            clearance = ROUGH_OPENING_CLEARANCE.get(wo.opening_type, {"width": 25, "height": 15})
            openings.append(Opening(
                opening_type=wo.opening_type,
                x=wo.position_along_mm,
                y=wo.position_y_mm,
                width=wo.width_mm,
                height=wo.height_mm,
                rough_width=wo.width_mm + 2 * clearance["width"],
                rough_height=wo.height_mm + clearance["height"],
            ))

        # Run panelization algorithm
        panel_data_list = panelize_wall(
            wall_length_mm=wall.length_mm,
            wall_height_mm=wall.height_mm,
            openings=openings,
            standard_width_mm=wall.standard_panel_width_mm,
            min_panel_width_mm=wall.min_panel_width_mm,
        )

        # Create BimPanel records with correct world coordinates
        rad = math.radians(wall.rotation_deg or 0)
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)
        base_y = 0.0

        # Get storey elevation
        if wall.storey_id:
            storey = self.db.query(BimStorey).filter(BimStorey.id == wall.storey_id).first()
            if storey:
                base_y = storey.elevation_mm

        for i, pd in enumerate(panel_data_list):
            # Transform panel-local X to world XZ
            world_x = wall.start_x_mm + cos_r * pd.position_x_mm
            world_z = wall.start_z_mm + sin_r * pd.position_x_mm

            panel = BimPanel(
                project_id=wall.project_id,
                wall_id=wall.id,
                storey_id=wall.storey_id,
                is_auto_generated=True,
                label=f"{wall.label}-P{i + 1:02d}",
                orientation="wall",
                pos_x_mm=world_x,
                pos_y_mm=base_y,
                pos_z_mm=world_z,
                rotation_deg=wall.rotation_deg or 0,
                width_mm=pd.width_mm,
                height_mm=pd.height_mm,
                thickness_mm=wall.thickness_mm,
                has_opening=pd.has_opening,
                opening_type=pd.opening_type,
                opening_x_mm=pd.opening_x_mm,
                opening_y_mm=pd.opening_y_mm,
                opening_width_mm=pd.opening_width_mm,
                opening_height_mm=pd.opening_height_mm,
            )
            self.db.add(panel)

        wall.panel_count = len(panel_data_list)


def _wall_to_dict(w: BimWall) -> dict:
    return {
        "id": w.id,
        "project_id": w.project_id,
        "storey_id": w.storey_id,
        "label": w.label,
        "start_x_mm": w.start_x_mm,
        "start_z_mm": w.start_z_mm,
        "end_x_mm": w.end_x_mm,
        "end_z_mm": w.end_z_mm,
        "height_mm": w.height_mm,
        "thickness_mm": w.thickness_mm,
        "length_mm": w.length_mm,
        "rotation_deg": w.rotation_deg,
        "panel_count": w.panel_count,
        "standard_panel_width_mm": w.standard_panel_width_mm,
        "stud_spacing_mm": w.stud_spacing_mm,
        "openings": [_opening_to_dict(o) for o in w.openings] if w.openings else [],
    }


def _panel_to_dict(p: BimPanel) -> dict:
    return {
        "id": p.id,
        "wall_id": p.wall_id,
        "label": p.label,
        "pos_x_mm": p.pos_x_mm,
        "pos_y_mm": p.pos_y_mm,
        "pos_z_mm": p.pos_z_mm,
        "rotation_deg": p.rotation_deg,
        "width_mm": p.width_mm,
        "height_mm": p.height_mm,
        "thickness_mm": p.thickness_mm,
        "has_opening": p.has_opening,
        "opening_type": p.opening_type,
        "opening_x_mm": p.opening_x_mm,
        "opening_y_mm": p.opening_y_mm,
        "opening_width_mm": p.opening_width_mm,
        "opening_height_mm": p.opening_height_mm,
    }


def _opening_to_dict(o: BimWallOpening) -> dict:
    return {
        "id": o.id,
        "wall_id": o.wall_id,
        "opening_type": o.opening_type,
        "label": o.label,
        "position_along_mm": o.position_along_mm,
        "position_y_mm": o.position_y_mm,
        "width_mm": o.width_mm,
        "height_mm": o.height_mm,
    }
