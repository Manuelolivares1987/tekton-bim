"""Floor plan models for the 2D plan editor."""

import math
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class FloorPlan(Base):
    __tablename__ = "floor_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    grid_size_mm = Column(Float, default=100.0)
    default_wall_thickness_mm = Column(Float, default=150.0)
    default_wall_height_mm = Column(Float, default=2440.0)
    ifc_model_id = Column(Integer, ForeignKey("ifc_models.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    project = relationship("Project")
    ifc_model = relationship("IfcModel")
    storeys = relationship("FloorPlanStorey", back_populates="floor_plan",
                           cascade="all, delete-orphan", order_by="FloorPlanStorey.level_index")

    __table_args__ = (
        Index("idx_floor_plans_project", "project_id"),
    )


class FloorPlanStorey(Base):
    __tablename__ = "floor_plan_storeys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor_plan_id = Column(Integer, ForeignKey("floor_plans.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    level_index = Column(Integer, nullable=False)
    elevation_mm = Column(Float, default=0.0)
    height_mm = Column(Float, default=2440.0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    floor_plan = relationship("FloorPlan", back_populates="storeys")
    walls = relationship("FloorPlanWall", back_populates="storey", cascade="all, delete-orphan")


class FloorPlanWall(Base):
    __tablename__ = "floor_plan_walls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storey_id = Column(Integer, ForeignKey("floor_plan_storeys.id", ondelete="CASCADE"), nullable=False)
    start_x_mm = Column(Float, nullable=False)
    start_y_mm = Column(Float, nullable=False)
    end_x_mm = Column(Float, nullable=False)
    end_y_mm = Column(Float, nullable=False)
    thickness_mm = Column(Float, default=150.0)
    height_mm = Column(Float, nullable=True)  # null = use storey height
    label = Column(String(50))
    ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    storey = relationship("FloorPlanStorey", back_populates="walls")
    openings = relationship("FloorPlanOpening", back_populates="wall", cascade="all, delete-orphan")
    ifc_element = relationship("IfcElement")

    @property
    def length_mm(self) -> float:
        dx = self.end_x_mm - self.start_x_mm
        dy = self.end_y_mm - self.start_y_mm
        return math.sqrt(dx * dx + dy * dy)

    @property
    def effective_height_mm(self) -> float:
        if self.height_mm:
            return self.height_mm
        if self.storey:
            return self.storey.height_mm
        return 2440.0

    __table_args__ = (
        Index("idx_floor_plan_walls_storey", "storey_id"),
    )


class FloorPlanOpening(Base):
    __tablename__ = "floor_plan_openings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wall_id = Column(Integer, ForeignKey("floor_plan_walls.id", ondelete="CASCADE"), nullable=False)
    opening_type = Column(String(50), nullable=False)  # door, window
    position_along_wall_mm = Column(Float, nullable=False)
    position_y_mm = Column(Float, default=0.0)
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    wall = relationship("FloorPlanWall", back_populates="openings")
