from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base


class PanelLayer(Base):
    __tablename__ = "panel_layers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    panel_id = Column(Integer, ForeignKey("panels.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    layer_order = Column(Integer, nullable=False)
    thickness_mm = Column(Float, nullable=False)
    description = Column(String(255))

    panel = relationship("Panel", back_populates="layers")
    material = relationship("Material")

    __table_args__ = (
        UniqueConstraint("panel_id", "layer_order", name="uq_panel_layer_order"),
    )
