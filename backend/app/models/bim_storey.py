"""BIM Storey model - floor levels for the modular construction system."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class BimStorey(Base):
    __tablename__ = "bim_storeys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # "Piso 1", "Piso 2"
    level_index = Column(Integer, nullable=False, default=0)  # 0=ground, 1=first, -1=basement
    elevation_mm = Column(Float, nullable=False, default=0.0)  # height from ground level
    floor_height_mm = Column(Float, nullable=False, default=2440.0)  # storey height (wall height)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    project = relationship("Project")

    __table_args__ = (
        Index("idx_bim_storeys_project", "project_id"),
    )
