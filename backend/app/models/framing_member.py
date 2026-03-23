"""Framing member model for wood frame panels."""

from sqlalchemy import Column, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class FramingMember(Base):
    __tablename__ = "framing_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    panel_instance_id = Column(Integer, ForeignKey("panel_instances.id", ondelete="CASCADE"), nullable=False)
    member_type = Column(String(50), nullable=False)
    # stud, king_stud, jack_stud, cripple_stud, top_plate, bottom_plate, header, sill_plate
    position_x_mm = Column(Float, nullable=False)  # relative to panel
    position_y_mm = Column(Float, nullable=False)
    length_mm = Column(Float, nullable=False)
    width_mm = Column(Float, nullable=False)   # stud width (38mm for 2x)
    depth_mm = Column(Float, nullable=False)   # stud depth (89mm for 2x4)
    lumber_size = Column(String(20), default="2x4")
    quantity = Column(Integer, default=1)

    panel_instance = relationship("PanelInstance")

    __table_args__ = (
        Index("idx_framing_members_panel", "panel_instance_id"),
    )
