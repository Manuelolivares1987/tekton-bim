"""Material library management service."""

from sqlalchemy.orm import Session

from app.models.material import Material


class MaterialService:
    """Manages the material library."""

    def __init__(self, db: Session):
        self.db = db

    def create_material(self, **kwargs) -> Material:
        """Create a new material."""
        material = Material(**kwargs)
        self.db.add(material)
        self.db.commit()
        self.db.refresh(material)
        return material

    def update_material(self, material_id: int, **kwargs) -> Material | None:
        """Update a material."""
        material = self.db.query(Material).filter(Material.id == material_id).first()
        if not material:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(material, key):
                setattr(material, key, value)
        self.db.commit()
        self.db.refresh(material)
        return material

    def delete_material(self, material_id: int) -> bool:
        """Delete a material."""
        material = self.db.query(Material).filter(Material.id == material_id).first()
        if not material:
            return False
        self.db.delete(material)
        self.db.commit()
        return True

    def get_material(self, material_id: int) -> Material | None:
        """Get a material by ID."""
        return self.db.query(Material).filter(Material.id == material_id).first()

    def get_all_materials(self, category: str | None = None) -> list[Material]:
        """Get all materials, optionally filtered by category."""
        query = self.db.query(Material)
        if category:
            query = query.filter(Material.category == category)
        return query.order_by(Material.category, Material.name).all()

    def get_volcanic_rock_materials(self) -> list[Material]:
        """Get all volcanic rock materials."""
        return (
            self.db.query(Material)
            .filter(Material.is_volcanic_rock == True)
            .order_by(Material.density_kg_m3)
            .all()
        )
