"""BimWall model - the primary design entity. Users draw walls, system generates panels."""

import math
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class BimWall(Base):
    __tablename__ = "bim_walls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    storey_id = Column(Integer, ForeignKey("bim_storeys.id", ondelete="SET NULL"), nullable=True)
    label = Column(String(50), nullable=False)

    # Geometry: two endpoints in XZ plane (mm)
    start_x_mm = Column(Float, nullable=False)
    start_z_mm = Column(Float, nullable=False)
    end_x_mm = Column(Float, nullable=False)
    end_z_mm = Column(Float, nullable=False)

    # Properties
    height_mm = Column(Float, nullable=False, default=2440.0)
    thickness_mm = Column(Float, nullable=False, default=136.0)

    # SIP / Framing config
    standard_panel_width_mm = Column(Float, default=1220.0)
    min_panel_width_mm = Column(Float, default=200.0)
    stud_spacing_mm = Column(Float, default=400.0)
    stud_width_mm = Column(Float, default=38.0)
    stud_depth_mm = Column(Float, default=89.0)
    lumber_size = Column(String(20), default="2x4")
    plate_count_top = Column(Integer, default=2)
    plate_count_bottom = Column(Integer, default=1)
    # Joint type between panels: "tablilla_osb" (OSB splines) or "lumber_spline" (pie derecho)
    joint_type = Column(String(20), default="tablilla_osb")
    # Max lumber length for continuous plates (mm) - Chile default 3200
    max_lumber_length_mm = Column(Float, default=3200.0)

    # Computed (cached on save)
    length_mm = Column(Float, nullable=True)
    rotation_deg = Column(Float, nullable=True)
    panel_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    panels = relationship("BimPanel", back_populates="wall", cascade="all, delete-orphan",
                         foreign_keys="BimPanel.wall_id")
    openings = relationship("BimWallOpening", back_populates="wall", cascade="all, delete-orphan",
                           order_by="BimWallOpening.position_along_mm")

    __table_args__ = (
        Index("idx_bim_walls_project", "project_id"),
    )

    def compute_geometry(self):
        """Compute length and rotation from endpoints."""
        dx = self.end_x_mm - self.start_x_mm
        dz = self.end_z_mm - self.start_z_mm
        self.length_mm = math.sqrt(dx * dx + dz * dz)
        self.rotation_deg = math.degrees(math.atan2(dz, dx))
