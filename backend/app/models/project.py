from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    location = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    ifc_models = relationship("IfcModel", back_populates="project", cascade="all, delete-orphan")
    panels = relationship("Panel", back_populates="project")
    calculation_results = relationship("CalculationResult", back_populates="project", cascade="all, delete-orphan")
