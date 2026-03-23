from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class CalculationResult(Base):
    __tablename__ = "calculation_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    ifc_model_id = Column(Integer, ForeignKey("ifc_models.id", ondelete="SET NULL"), nullable=True)
    calculation_type = Column(String(100), nullable=False)
    parameters_json = Column(Text)
    results_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    project = relationship("Project", back_populates="calculation_results")
