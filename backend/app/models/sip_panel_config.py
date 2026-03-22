"""SIP panel configuration model."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class SipPanelConfig(Base):
    __tablename__ = "sip_panel_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)

    # Core (insulation)
    core_material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    core_thickness_mm = Column(Float, nullable=False)  # 64, 89, 114, 140, 165, 210

    # Skins (faces)
    skin_material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    skin_thickness_mm = Column(Float, nullable=False)  # 11, 15

    # Standard panel dimensions
    standard_width_mm = Column(Float, default=1220.0)
    standard_height_mm = Column(Float, default=2440.0)
    max_width_mm = Column(Float, default=1220.0)
    max_height_mm = Column(Float, default=3660.0)
    min_panel_width_mm = Column(Float, default=200.0)

    # Joint type
    joint_type = Column(String(50), default="spline")  # spline, cam_lock, surface_spline
    spline_material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    spline_width_mm = Column(Float, default=89.0)
    spline_depth_mm = Column(Float, default=38.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    core_material = relationship("Material", foreign_keys=[core_material_id])
    skin_material = relationship("Material", foreign_keys=[skin_material_id])
    spline_material = relationship("Material", foreign_keys=[spline_material_id])
