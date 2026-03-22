from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class MepElectricalDevice(Base):
    __tablename__ = "mep_electrical_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    circuit_id = Column(Integer, ForeignKey("mep_circuits.id", ondelete="CASCADE"), nullable=False)
    device_type = Column(String(100), nullable=False)
    watts = Column(Float)
    location_x = Column(Float)
    location_y = Column(Float)
    location_z = Column(Float)
    storey_name = Column(String(255))
    description = Column(String(500))

    circuit = relationship("MepCircuit", back_populates="devices")
