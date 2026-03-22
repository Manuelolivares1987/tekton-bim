"""Wall opening model for doors and windows detected from IFC."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class WallOpening(Base):
    __tablename__ = "wall_openings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id", ondelete="CASCADE"), nullable=False)
    opening_ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id"), nullable=True)
    opening_type = Column(String(50), nullable=False)  # door, window
    position_x_mm = Column(Float, nullable=False)  # from wall start
    position_y_mm = Column(Float, nullable=False)  # from wall bottom
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    rough_opening_width_mm = Column(Float, nullable=False)  # with clearances
    rough_opening_height_mm = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    wall_element = relationship("IfcElement", foreign_keys=[ifc_element_id])
    opening_element = relationship("IfcElement", foreign_keys=[opening_ifc_element_id])

    __table_args__ = (
        Index("idx_wall_openings_element", "ifc_element_id"),
    )
