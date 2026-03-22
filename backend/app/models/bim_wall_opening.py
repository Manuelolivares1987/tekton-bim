"""BimWallOpening model - doors/windows placed on walls."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class BimWallOpening(Base):
    __tablename__ = "bim_wall_openings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wall_id = Column(Integer, ForeignKey("bim_walls.id", ondelete="CASCADE"), nullable=False)
    opening_type = Column(String(20), nullable=False)  # "door" | "window"
    label = Column(String(50), nullable=True)

    # Position along the wall (mm from wall start point)
    position_along_mm = Column(Float, nullable=False)
    # Vertical position from floor (0 for doors, ~900 for windows)
    position_y_mm = Column(Float, nullable=False, default=0.0)

    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    wall = relationship("BimWall", back_populates="openings")

    __table_args__ = (
        Index("idx_bim_wall_openings_wall", "wall_id"),
    )
