"""BIM panel model - individual panels placed in the 3D scene."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class BimPanel(Base):
    __tablename__ = "bim_panels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    panel_catalog_id = Column(Integer, ForeignKey("panel_catalog.id"), nullable=True)
    wall_id = Column(Integer, ForeignKey("bim_walls.id", ondelete="CASCADE"), nullable=True)
    wall_group_id = Column(Integer, ForeignKey("wall_groups.id", ondelete="SET NULL"), nullable=True)
    storey_id = Column(Integer, ForeignKey("bim_storeys.id", ondelete="SET NULL"), nullable=True)
    is_auto_generated = Column(Boolean, default=False)
    label = Column(String(50), nullable=False)
    storey_name = Column(String(255), default="Piso 1")

    # Panel orientation: wall (vertical), floor (horizontal down), roof (horizontal angled)
    orientation = Column(String(20), default="wall")  # wall | floor | roof

    # 3D position (mm)
    pos_x_mm = Column(Float, nullable=False, default=0.0)
    pos_y_mm = Column(Float, nullable=False, default=0.0)  # vertical (height)
    pos_z_mm = Column(Float, nullable=False, default=0.0)

    # Rotation (degrees around Y axis: 0, 90, 180, 270)
    rotation_deg = Column(Float, default=0.0)

    # For roof panels: pitch angle
    pitch_deg = Column(Float, default=0.0)

    # Dimensions
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    thickness_mm = Column(Float, nullable=False)

    # Opening (door/window)
    has_opening = Column(Boolean, default=False)
    opening_type = Column(String(50), nullable=True)
    opening_x_mm = Column(Float, nullable=True)  # position along panel width
    opening_y_mm = Column(Float, nullable=True)  # position from panel bottom
    opening_width_mm = Column(Float, nullable=True)
    opening_height_mm = Column(Float, nullable=True)

    # Bridge link
    ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id"), nullable=True)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    catalog_item = relationship("PanelCatalog")
    wall = relationship("BimWall", back_populates="panels", foreign_keys=[wall_id])
    wall_group = relationship("WallGroup", back_populates="panels")

    __table_args__ = (
        Index("idx_bim_panels_project", "project_id"),
        Index("idx_bim_panels_wall_group", "wall_group_id"),
    )
