from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from app.models.base import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    category = Column(String(100), nullable=False)
    density_kg_m3 = Column(Float)
    thermal_conductivity_w_mk = Column(Float)
    cost_per_unit = Column(Float)
    cost_unit = Column(String(20), default="kg")
    description = Column(Text)
    is_volcanic_rock = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
