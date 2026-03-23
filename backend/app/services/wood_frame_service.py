"""Wood frame panel generation service.

Generates framing members (studs, plates, headers, etc.) for a panel instance.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.framing_member import FramingMember
from app.models.panelization_result import PanelInstance, PanelizationResult
from app.models.wood_frame_config import WoodFrameConfig

# Header depth lookup by opening width (mm -> header depth mm)
# Based on IRC prescriptive header sizing for single-story
HEADER_DEPTH_TABLE = [
    (1220, 140),   # up to 4ft -> 2x6 header
    (1830, 184),   # up to 6ft -> 2x8 header
    (2440, 235),   # up to 8ft -> 2x10 header
    (3050, 286),   # up to 10ft -> 2x12 header
]


def get_header_depth(opening_width_mm: float, config_depth: float = 0) -> float:
    """Get header depth based on opening width or config override."""
    if config_depth > 0:
        return config_depth
    for max_width, depth in HEADER_DEPTH_TABLE:
        if opening_width_mm <= max_width:
            return depth
    return 286  # default to 2x12


@dataclass
class MemberData:
    member_type: str
    position_x_mm: float
    position_y_mm: float
    length_mm: float
    width_mm: float
    depth_mm: float
    lumber_size: str
    quantity: int = 1


def generate_framing(
    panel_width_mm: float,
    panel_height_mm: float,
    stud_spacing_mm: float = 400.0,
    stud_width_mm: float = 38.0,
    stud_depth_mm: float = 89.0,
    lumber_size: str = "2x4",
    plate_count_top: int = 2,
    plate_count_bottom: int = 1,
    header_depth_override: float = 0,
    has_opening: bool = False,
    opening_x_mm: float = 0,
    opening_y_mm: float = 0,
    opening_width_mm: float = 0,
    opening_height_mm: float = 0,
    opening_type: str | None = None,
) -> list[MemberData]:
    """Generate framing members for a single panel. Pure function."""
    members: list[MemberData] = []

    # Calculate plate zone
    bottom_plate_height = stud_width_mm * plate_count_bottom
    top_plate_height = stud_width_mm * plate_count_top
    stud_zone_bottom = bottom_plate_height
    stud_zone_top = panel_height_mm - top_plate_height
    stud_height = stud_zone_top - stud_zone_bottom

    if stud_height <= 0:
        return members

    # === PLATES ===
    # Bottom plate(s)
    for i in range(plate_count_bottom):
        members.append(MemberData(
            member_type="bottom_plate",
            position_x_mm=0,
            position_y_mm=i * stud_width_mm,
            length_mm=panel_width_mm,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))

    # Top plate(s)
    for i in range(plate_count_top):
        members.append(MemberData(
            member_type="top_plate",
            position_x_mm=0,
            position_y_mm=stud_zone_top + i * stud_width_mm,
            length_mm=panel_width_mm,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))

    # === STUDS ===
    # Generate stud positions at regular spacing
    stud_positions: list[float] = [0]  # always start at x=0
    x = stud_spacing_mm
    while x < panel_width_mm - stud_width_mm:
        stud_positions.append(x)
        x += stud_spacing_mm
    # End stud
    end_x = panel_width_mm - stud_width_mm
    if end_x > 0 and end_x not in stud_positions:
        stud_positions.append(end_x)

    if not has_opening:
        # Simple case: all full-height studs
        for sx in stud_positions:
            members.append(MemberData(
                member_type="stud",
                position_x_mm=sx,
                position_y_mm=stud_zone_bottom,
                length_mm=stud_height,
                width_mm=stud_width_mm,
                depth_mm=stud_depth_mm,
                lumber_size=lumber_size,
            ))
        return members

    # === OPENING FRAMING ===
    opening_left = opening_x_mm
    opening_right = opening_x_mm + opening_width_mm
    opening_bottom = opening_y_mm
    opening_top = opening_y_mm + opening_height_mm

    header_depth = get_header_depth(opening_width_mm, header_depth_override)

    # King studs (full height, at each side of opening)
    king_left_x = max(0, opening_left - stud_width_mm)
    king_right_x = min(panel_width_mm - stud_width_mm, opening_right)

    members.append(MemberData(
        member_type="king_stud",
        position_x_mm=king_left_x,
        position_y_mm=stud_zone_bottom,
        length_mm=stud_height,
        width_mm=stud_width_mm,
        depth_mm=stud_depth_mm,
        lumber_size=lumber_size,
    ))
    members.append(MemberData(
        member_type="king_stud",
        position_x_mm=king_right_x,
        position_y_mm=stud_zone_bottom,
        length_mm=stud_height,
        width_mm=stud_width_mm,
        depth_mm=stud_depth_mm,
        lumber_size=lumber_size,
    ))

    # Jack studs (trimmers: from bottom plate to header bottom)
    jack_left_x = king_left_x + stud_width_mm
    jack_right_x = king_right_x - stud_width_mm
    header_bottom_y = opening_top
    jack_height = header_bottom_y - stud_zone_bottom

    if jack_height > 0:
        members.append(MemberData(
            member_type="jack_stud",
            position_x_mm=jack_left_x,
            position_y_mm=stud_zone_bottom,
            length_mm=jack_height,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))
        members.append(MemberData(
            member_type="jack_stud",
            position_x_mm=jack_right_x,
            position_y_mm=stud_zone_bottom,
            length_mm=jack_height,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))

    # Header (horizontal at top of opening)
    header_width = opening_right - opening_left
    members.append(MemberData(
        member_type="header",
        position_x_mm=opening_left,
        position_y_mm=header_bottom_y,
        length_mm=header_width,
        width_mm=header_depth,
        depth_mm=stud_depth_mm,
        lumber_size=lumber_size,
        quantity=2,  # typically double header
    ))

    # Sill plate (windows only)
    if opening_type == "window" and opening_bottom > stud_zone_bottom:
        members.append(MemberData(
            member_type="sill_plate",
            position_x_mm=opening_left,
            position_y_mm=opening_bottom,
            length_mm=header_width,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))

    # Cripple studs above header
    cripple_top_y = header_bottom_y + header_depth
    cripple_top_height = stud_zone_top - cripple_top_y
    if cripple_top_height > stud_width_mm:
        cx = opening_left + stud_spacing_mm
        while cx < opening_right - stud_width_mm:
            members.append(MemberData(
                member_type="cripple_stud",
                position_x_mm=cx,
                position_y_mm=cripple_top_y,
                length_mm=cripple_top_height,
                width_mm=stud_width_mm,
                depth_mm=stud_depth_mm,
                lumber_size=lumber_size,
            ))
            cx += stud_spacing_mm

    # Cripple studs below sill (windows only)
    if opening_type == "window" and opening_bottom > stud_zone_bottom + stud_width_mm:
        cripple_bottom_height = opening_bottom - stud_zone_bottom - stud_width_mm
        if cripple_bottom_height > stud_width_mm:
            cx = opening_left + stud_spacing_mm
            while cx < opening_right - stud_width_mm:
                members.append(MemberData(
                    member_type="cripple_stud",
                    position_x_mm=cx,
                    position_y_mm=stud_zone_bottom,
                    length_mm=cripple_bottom_height,
                    width_mm=stud_width_mm,
                    depth_mm=stud_depth_mm,
                    lumber_size=lumber_size,
                ))
                cx += stud_spacing_mm

    # Regular studs outside the opening zone
    for sx in stud_positions:
        # Skip studs in the opening zone (between king studs)
        if king_left_x - stud_width_mm < sx < king_right_x + stud_width_mm:
            continue
        members.append(MemberData(
            member_type="stud",
            position_x_mm=sx,
            position_y_mm=stud_zone_bottom,
            length_mm=stud_height,
            width_mm=stud_width_mm,
            depth_mm=stud_depth_mm,
            lumber_size=lumber_size,
        ))

    return members


class WoodFrameService:
    """High-level service for wood frame panel generation with DB persistence."""

    def __init__(self, db: Session):
        self.db = db

    def generate_framing_for_instance(
        self,
        panel_instance_id: int,
        wood_frame_config_id: int,
    ) -> list[FramingMember]:
        """Generate framing members for a panel instance."""
        instance = self.db.query(PanelInstance).filter(PanelInstance.id == panel_instance_id).first()
        if not instance:
            raise ValueError(f"Panel instance {panel_instance_id} not found")

        config = self.db.query(WoodFrameConfig).filter(WoodFrameConfig.id == wood_frame_config_id).first()
        if not config:
            raise ValueError(f"Wood frame config {wood_frame_config_id} not found")

        # Delete existing framing for this instance
        self.db.query(FramingMember).filter(FramingMember.panel_instance_id == panel_instance_id).delete()

        # Generate framing
        member_data_list = generate_framing(
            panel_width_mm=instance.width_mm,
            panel_height_mm=instance.height_mm,
            stud_spacing_mm=config.stud_spacing_mm,
            stud_width_mm=config.stud_width_mm,
            stud_depth_mm=config.stud_depth_mm,
            lumber_size=config.lumber_size,
            plate_count_top=config.plate_count_top,
            plate_count_bottom=config.plate_count_bottom,
            header_depth_override=config.header_depth_mm,
            has_opening=instance.has_opening,
            opening_x_mm=instance.opening_x_mm or 0,
            opening_y_mm=instance.opening_y_mm or 0,
            opening_width_mm=instance.opening_width_mm or 0,
            opening_height_mm=instance.opening_height_mm or 0,
            opening_type=instance.opening_type,
        )

        # Persist
        members = []
        for md in member_data_list:
            member = FramingMember(
                panel_instance_id=panel_instance_id,
                member_type=md.member_type,
                position_x_mm=md.position_x_mm,
                position_y_mm=md.position_y_mm,
                length_mm=md.length_mm,
                width_mm=md.width_mm,
                depth_mm=md.depth_mm,
                lumber_size=md.lumber_size,
                quantity=md.quantity,
            )
            self.db.add(member)
            members.append(member)

        self.db.commit()
        return members

    def get_framing(self, panel_instance_id: int) -> list[FramingMember]:
        """Get existing framing members for a panel instance."""
        return (
            self.db.query(FramingMember)
            .filter(FramingMember.panel_instance_id == panel_instance_id)
            .order_by(FramingMember.position_x_mm, FramingMember.position_y_mm)
            .all()
        )

    def generate_framing_for_result(
        self,
        result_id: int,
        wood_frame_config_id: int,
    ) -> int:
        """Generate framing for all panel instances in a panelization result."""
        result = self.db.query(PanelizationResult).filter(PanelizationResult.id == result_id).first()
        if not result:
            raise ValueError(f"Panelization result {result_id} not found")

        count = 0
        for instance in result.panel_instances:
            self.generate_framing_for_instance(instance.id, wood_frame_config_id)
            count += 1

        return count
