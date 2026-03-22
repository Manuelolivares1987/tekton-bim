"""Wood frame panel configuration model."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class WoodFrameConfig(Base):
    __tablename__ = "wood_frame_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)

    # Stud specifications
    stud_spacing_mm = Column(Float, default=400.0)  # 400 or 600 OC
    stud_width_mm = Column(Float, default=38.0)     # actual dimension (not nominal)
    stud_depth_mm = Column(Float, default=89.0)     # 89=2x4, 140=2x6, 184=2x8
    stud_material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    lumber_size = Column(String(20), default="2x4")  # nominal size label

    # Plates
    plate_count_top = Column(Integer, default=2)    # 1 or 2 (double top plate)
    plate_count_bottom = Column(Integer, default=1)

    # Sheathing
    sheathing_ext_material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    sheathing_ext_thickness_mm = Column(Float, default=11.0)
    sheathing_int_material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    sheathing_int_thickness_mm = Column(Float, default=12.7)

    # Header sizing (0 = auto-calculate based on span)
    header_depth_mm = Column(Float, default=0)

    # Panel dimensions
    standard_panel_width_mm = Column(Float, default=1220.0)
    max_panel_width_mm = Column(Float, default=2440.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    stud_material = relationship("Material", foreign_keys=[stud_material_id])
    sheathing_ext_material = relationship("Material", foreign_keys=[sheathing_ext_material_id])
    sheathing_int_material = relationship("Material", foreign_keys=[sheathing_int_material_id])
