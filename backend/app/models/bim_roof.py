"""BimRoof model — roof/techumbre definition for a project.

A roof is defined by:
- A set of perimeter points (derived from exterior walls or custom)
- Roof type (gable, hip, shed, flat)
- Pitch angle (degrees)
- Overhang (alero) distance
- Ridge orientation

The roof generates ridge, hip, valley lines and individual
roof planes that can later be panelized (SIP roof panels).
"""

import math
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class BimRoof(Base):
    __tablename__ = "bim_roofs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    storey_id = Column(Integer, ForeignKey("bim_storeys.id", ondelete="SET NULL"), nullable=True)
    label = Column(String(50), nullable=False)

    # Roof type
    roof_type = Column(String(30), nullable=False, default="gable")
    # gable (2 aguas), hip (4 aguas), shed (1 agua), flat (plano)

    # Geometry parameters
    pitch_deg = Column(Float, nullable=False, default=25.0)  # roof slope angle
    overhang_mm = Column(Float, default=400.0)  # alero/eaves overhang
    ridge_height_mm = Column(Float, nullable=True)  # computed from pitch + span

    # Ridge orientation: 0 = along X axis, 90 = along Z axis
    ridge_orientation_deg = Column(Float, default=0.0)

    # Bounding box of the roof footprint (derived from walls or manual)
    min_x_mm = Column(Float, default=0.0)
    min_z_mm = Column(Float, default=0.0)
    max_x_mm = Column(Float, default=0.0)
    max_z_mm = Column(Float, default=0.0)
    base_elevation_mm = Column(Float, default=2440.0)  # top of wall

    # Material
    thickness_mm = Column(Float, default=162.0)  # SIP roof panel thickness
    panel_width_mm = Column(Float, default=1220.0)  # standard SIP width

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    project = relationship("Project")

    __table_args__ = (
        Index("idx_bim_roofs_project", "project_id"),
    )

    @property
    def span_mm(self) -> float:
        """Width perpendicular to ridge."""
        if self.ridge_orientation_deg == 0:
            return self.max_z_mm - self.min_z_mm
        return self.max_x_mm - self.min_x_mm

    @property
    def ridge_length_mm(self) -> float:
        """Length along the ridge."""
        if self.ridge_orientation_deg == 0:
            return self.max_x_mm - self.min_x_mm
        return self.max_z_mm - self.min_z_mm

    def compute_ridge_height(self) -> float:
        """Compute ridge height from pitch and span."""
        half_span = self.span_mm / 2
        self.ridge_height_mm = half_span * math.tan(math.radians(self.pitch_deg))
        return self.ridge_height_mm
