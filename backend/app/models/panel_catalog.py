"""Panel catalog model - standard panel types available for BIM modeling."""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class PanelCatalog(Base):
    __tablename__ = "panel_catalog"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)  # null = global
    name = Column(String(255), nullable=False)
    category = Column(String(50), default="full")  # full, half, corner, custom
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    thickness_mm = Column(Float, nullable=False)
    core_material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    core_thickness_mm = Column(Float, default=114.0)
    skin_material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    skin_thickness_mm = Column(Float, default=11.0)
    weight_kg = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    core_material = relationship("Material", foreign_keys=[core_material_id])
    skin_material = relationship("Material", foreign_keys=[skin_material_id])
