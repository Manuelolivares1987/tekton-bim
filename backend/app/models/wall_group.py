"""Wall group model - groups adjacent panels into logical walls."""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class WallGroup(Base):
    __tablename__ = "wall_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # "Muro A", "Muro B"
    storey_id = Column(Integer, ForeignKey("bim_storeys.id", ondelete="CASCADE"), nullable=True)

    # Wall direction/axis info (computed from member panels)
    axis_angle_deg = Column(Float, default=0.0)  # 0=X axis, 90=Z axis
    total_length_mm = Column(Float, default=0.0)
    panel_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    project = relationship("Project")
    panels = relationship("BimPanel", back_populates="wall_group", order_by="BimPanel.label")

    __table_args__ = (
        Index("idx_wall_groups_project", "project_id"),
    )
