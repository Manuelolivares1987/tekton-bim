from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class MepCircuit(Base):
    __tablename__ = "mep_circuits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    circuit_name = Column(String(255), nullable=False)
    panel_name = Column(String(255))
    phase = Column(String(20), default="single")
    voltage = Column(Float, default=120.0)
    breaker_amps = Column(Float)
    wire_size_awg = Column(String(20))
    conduit_size = Column(String(20))
    conduit_type = Column(String(50))
    total_load_watts = Column(Float)
    total_length_m = Column(Float)
    voltage_drop_pct = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    devices = relationship("MepElectricalDevice", back_populates="circuit", cascade="all, delete-orphan")
