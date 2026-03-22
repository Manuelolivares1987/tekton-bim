from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class PanelAssignment(Base):
    __tablename__ = "panel_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    ifc_element_id = Column(Integer, ForeignKey("ifc_elements.id", ondelete="CASCADE"), nullable=False)
    panel_id = Column(Integer, ForeignKey("panels.id", ondelete="CASCADE"), nullable=False)
    panel_number = Column(String(50), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    ifc_element = relationship("IfcElement")
    panel = relationship("Panel")

    __table_args__ = (
        Index("idx_panel_assignments_project", "project_id"),
        Index("idx_panel_assignments_element", "ifc_element_id"),
    )
