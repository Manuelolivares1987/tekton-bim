"""Building code models - standards and regulations knowledge base."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class BuildingCode(Base):
    """A building code document (NCh433, CIRSOC, NSR-10, etc.)."""
    __tablename__ = "building_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)  # "NCh433 - Diseño Sísmico"
    country = Column(String(50), nullable=False)  # "chile", "argentina", etc.
    region = Column(String(100), nullable=True)  # optional sub-region
    code_type = Column(String(50), nullable=False)  # seismic, structural, fire, energy, plumbing
    version = Column(String(50), nullable=True)  # "2012", "Of.96 Mod.2009"
    source = Column(String(50), default="builtin")  # "builtin" | "uploaded"
    file_path = Column(String(500), nullable=True)  # path to PDF if uploaded
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("BuildingCodeChunk", back_populates="code", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_building_codes_country", "country"),
        Index("idx_building_codes_type", "code_type"),
    )


class BuildingCodeChunk(Base):
    """A chunk of text from a building code, categorized by topic."""
    __tablename__ = "building_code_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code_id = Column(Integer, ForeignKey("building_codes.id", ondelete="CASCADE"), nullable=False)
    section_title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    topic = Column(String(50), nullable=False)
    # Topics: seismic, structural_walls, structural_roof, fire_rating,
    #         insulation, ventilation, dimensions, openings, foundations,
    #         electrical, plumbing, accessibility, general
    keywords = Column(Text, nullable=True)  # comma-separated search keywords
    page_number = Column(Integer, nullable=True)
    relevance_score = Column(Float, default=1.0)  # higher = more important

    code = relationship("BuildingCode", back_populates="chunks")

    __table_args__ = (
        Index("idx_chunks_code", "code_id"),
        Index("idx_chunks_topic", "topic"),
    )
