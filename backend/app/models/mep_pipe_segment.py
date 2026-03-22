from sqlalchemy import Column, Integer, String, Float, ForeignKey
from app.models.base import Base


class MepPipeSegment(Base):
    __tablename__ = "mep_pipe_segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    system_type = Column(String(50), nullable=False)
    pipe_material = Column(String(50))
    diameter_mm = Column(Float, nullable=False)
    length_m = Column(Float, nullable=False)
    start_fixture_id = Column(Integer, ForeignKey("mep_plumbing_fixtures.id"), nullable=True)
    end_fixture_id = Column(Integer, ForeignKey("mep_plumbing_fixtures.id"), nullable=True)
    flow_gpm = Column(Float)
    pressure_drop_kpa = Column(Float)
