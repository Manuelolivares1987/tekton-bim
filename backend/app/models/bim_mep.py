"""BIM MEP models — Mechanical, Electrical, Plumbing objects.

Organized as a single module with distinct classes per discipline.
Each MEP object relates to a project and optionally to a wall/storey.
"""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class MepObject(Base):
    """Base MEP object — any installable element (outlet, pipe, duct, etc.)."""
    __tablename__ = "mep_objects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    storey_id = Column(Integer, ForeignKey("bim_storeys.id", ondelete="SET NULL"), nullable=True)
    wall_id = Column(Integer, ForeignKey("bim_walls.id", ondelete="SET NULL"), nullable=True)

    label = Column(String(50), nullable=False)
    discipline = Column(String(20), nullable=False)
    # "electrical" | "plumbing" | "hvac"
    object_type = Column(String(50), nullable=False)
    # electrical: outlet, switch, panel, light, smoke_detector
    # plumbing: sink, toilet, shower, water_heater, drain, supply_pipe
    # hvac: duct, vent, split_unit, thermostat

    # Position (mm, relative to wall start if wall_id set, otherwise absolute)
    pos_x_mm = Column(Float, default=0.0)
    pos_y_mm = Column(Float, default=0.0)  # height from floor
    pos_z_mm = Column(Float, default=0.0)
    position_along_wall_mm = Column(Float, nullable=True)  # if attached to wall

    # Properties
    power_watts = Column(Float, nullable=True)     # electrical load
    flow_rate_lpm = Column(Float, nullable=True)   # plumbing flow
    pipe_diameter_mm = Column(Float, nullable=True) # pipe size
    circuit_id = Column(String(50), nullable=True)  # electrical circuit label
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    project = relationship("Project")

    __table_args__ = (
        Index("idx_mep_objects_project", "project_id"),
        Index("idx_mep_objects_discipline", "discipline"),
    )
