"""Panelization result and panel instance models."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class PanelizationResult(Base):
    __tablename__ = "panelization_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id", ondelete="CASCADE"), nullable=False)
    config_type = Column(String(50), nullable=False)  # sip, wood_frame
    sip_config_id = Column(Integer, ForeignKey("sip_panel_configs.id"), nullable=True)
    wood_frame_config_id = Column(Integer, nullable=True)  # FK added in Phase 2
    status = Column(String(50), default="draft")  # draft, confirmed
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    project = relationship("Project")
    ifc_element = relationship("IfcElement")
    sip_config = relationship("SipPanelConfig")
    panel_instances = relationship("PanelInstance", back_populates="panelization_result",
                                   cascade="all, delete-orphan", order_by="PanelInstance.sequence_order")

    __table_args__ = (
        Index("idx_panelization_results_project", "project_id"),
        Index("idx_panelization_results_element", "ifc_element_id"),
    )


class PanelInstance(Base):
    __tablename__ = "panel_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    panelization_result_id = Column(Integer, ForeignKey("panelization_results.id", ondelete="CASCADE"), nullable=False)
    panel_label = Column(String(50), nullable=False)  # e.g. SIP-001-A
    sequence_order = Column(Integer, nullable=False)
    position_x_mm = Column(Float, nullable=False)  # offset from wall start
    position_y_mm = Column(Float, default=0.0)  # offset from wall bottom
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    is_custom_cut = Column(Boolean, default=False)
    has_opening = Column(Boolean, default=False)
    opening_type = Column(String(50), nullable=True)  # door, window
    opening_x_mm = Column(Float, nullable=True)  # relative to panel
    opening_y_mm = Column(Float, nullable=True)
    opening_width_mm = Column(Float, nullable=True)
    opening_height_mm = Column(Float, nullable=True)
    panel_type = Column(String(50), default="full")  # full, corner_left, corner_right, t_junction, filler, header, sill
    weight_kg = Column(Float, default=0.0)
    area_m2 = Column(Float, default=0.0)  # net area (minus opening)
    notes = Column(Text)

    panelization_result = relationship("PanelizationResult", back_populates="panel_instances")

    __table_args__ = (
        Index("idx_panel_instances_result", "panelization_result_id"),
    )
