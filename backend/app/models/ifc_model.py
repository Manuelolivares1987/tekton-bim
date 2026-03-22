from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class IfcModel(Base):
    __tablename__ = "ifc_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size_bytes = Column(Integer)
    ifc_schema = Column(String(50))
    authoring_tool = Column(String(255))
    parsed_at = Column(DateTime)
    element_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="ifc_models")
    elements = relationship("IfcElement", back_populates="ifc_model", cascade="all, delete-orphan")
