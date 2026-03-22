from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from app.models.base import Base


class MepPlumbingFixture(Base):
    __tablename__ = "mep_plumbing_fixtures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    fixture_type = Column(String(100), nullable=False)
    fixture_units = Column(Float, nullable=False)
    hot_water = Column(Boolean, default=False)
    cold_water = Column(Boolean, default=True)
    drain_size_mm = Column(Float)
    location_x = Column(Float)
    location_y = Column(Float)
    location_z = Column(Float)
    storey_name = Column(String(255))
