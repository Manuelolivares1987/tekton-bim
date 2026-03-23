from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Panel(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text)
    total_thickness_mm = Column(Float)
    total_weight_per_m2_kg = Column(Float)
    r_value_m2k_w = Column(Float)
    volcanic_rock_kg_per_unit = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    project = relationship("Project", back_populates="panels")
    layers = relationship("PanelLayer", back_populates="panel", cascade="all, delete-orphan", order_by="PanelLayer.layer_order")
