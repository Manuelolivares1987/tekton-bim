from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class IfcElement(Base):
    __tablename__ = "ifc_elements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ifc_model_id = Column(Integer, ForeignKey("ifc_models.id", ondelete="CASCADE"), nullable=False)
    global_id = Column(String(64), nullable=False)
    ifc_type = Column(String(100), nullable=False)
    name = Column(String(500))
    description = Column(Text)
    storey_name = Column(String(255))
    type_name = Column(String(255))

    length_m = Column(Float)
    height_m = Column(Float)
    width_m = Column(Float)
    gross_area_m2 = Column(Float)
    net_area_m2 = Column(Float)
    volume_m3 = Column(Float)

    properties_json = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    ifc_model = relationship("IfcModel", back_populates="elements")

    __table_args__ = (
        UniqueConstraint("ifc_model_id", "global_id", name="uq_model_element"),
        Index("idx_ifc_elements_model_type", "ifc_model_id", "ifc_type"),
        Index("idx_ifc_elements_global_id", "global_id"),
    )
