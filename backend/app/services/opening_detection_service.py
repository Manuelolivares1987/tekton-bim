"""Service for detecting wall openings (doors/windows) from IFC models."""

import ifcopenshell
import ifcopenshell.util.placement

from sqlalchemy.orm import Session

from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel
from app.models.wall_opening import WallOpening
from app.core.sip_constants import ROUGH_OPENING_CLEARANCE


class OpeningDetectionService:
    """Detects and stores wall openings from IFC models."""

    def __init__(self, db: Session):
        self.db = db

    def detect_openings_for_wall(self, ifc_element_id: int, ifc_file_path: str) -> list[WallOpening]:
        """Detect openings (doors/windows) hosted in a wall element from the IFC file."""
        element = self.db.query(IfcElement).filter(IfcElement.id == ifc_element_id).first()
        if not element:
            raise ValueError(f"IFC Element {ifc_element_id} not found")

        # Clear existing openings for this wall
        self.db.query(WallOpening).filter(WallOpening.ifc_element_id == ifc_element_id).delete()

        try:
            ifc_model = ifcopenshell.open(ifc_file_path)
            wall = ifc_model.by_guid(element.global_id)
            openings = self._extract_openings_from_wall(wall, element, ifc_model)
        except Exception:
            # If IFC parsing fails, return empty list (user can add manually)
            self.db.commit()
            return []

        result = []
        for opening_data in openings:
            wall_opening = WallOpening(
                ifc_element_id=ifc_element_id,
                **opening_data,
            )
            self.db.add(wall_opening)
            result.append(wall_opening)

        self.db.commit()
        return result

    def _extract_openings_from_wall(self, wall, db_element: IfcElement, ifc_model) -> list[dict]:
        """Extract opening positions and dimensions from IFC wall element."""
        openings = []

        if not hasattr(wall, "HasOpenings"):
            return openings

        wall_length_mm = (db_element.length_m or 0) * 1000
        wall_height_mm = (db_element.height_m or 0) * 1000

        for rel_voids in wall.HasOpenings:
            opening_element = rel_voids.RelatedOpeningElement
            if not opening_element:
                continue

            # Determine opening type from filling element
            opening_type = "window"
            filling_element_id = None

            if hasattr(opening_element, "HasFillings"):
                for rel_fills in opening_element.HasFillings:
                    filling = rel_fills.RelatedBuildingElement
                    if filling:
                        if filling.is_a("IfcDoor"):
                            opening_type = "door"
                        elif filling.is_a("IfcWindow"):
                            opening_type = "window"

                        # Find this element in our DB
                        db_filling = (
                            self.db.query(IfcElement)
                            .filter(
                                IfcElement.global_id == filling.GlobalId,
                            )
                            .first()
                        )
                        if db_filling:
                            filling_element_id = db_filling.id

            # Extract opening dimensions and position
            dims = self._get_opening_dimensions(opening_element)
            position = self._get_opening_position_relative_to_wall(
                opening_element, wall, wall_length_mm, wall_height_mm
            )

            width_mm = dims.get("width", 900)
            height_mm = dims.get("height", 2100 if opening_type == "door" else 1200)
            position_x_mm = position.get("x", 0)
            position_y_mm = position.get("y", 0 if opening_type == "door" else 900)

            # Calculate rough opening with clearances
            clearance = ROUGH_OPENING_CLEARANCE.get(opening_type, {"width": 25, "height": 15})
            rough_width = width_mm + 2 * clearance["width"]
            rough_height = height_mm + clearance["height"] + (clearance["height"] if opening_type == "window" else 0)

            openings.append({
                "opening_ifc_element_id": filling_element_id,
                "opening_type": opening_type,
                "position_x_mm": position_x_mm,
                "position_y_mm": position_y_mm,
                "width_mm": width_mm,
                "height_mm": height_mm,
                "rough_opening_width_mm": rough_width,
                "rough_opening_height_mm": rough_height,
            })

        return openings

    def _get_opening_dimensions(self, opening_element) -> dict:
        """Extract width and height from an IfcOpeningElement."""
        result = {"width": 900, "height": 2100}

        try:
            # Try from representation bounding box
            if opening_element.Representation:
                for rep in opening_element.Representation.Representations:
                    for item in rep.Items:
                        if item.is_a("IfcExtrudedAreaSolid"):
                            profile = item.SweptArea
                            if profile.is_a("IfcRectangleProfileDef"):
                                result["width"] = profile.XDim * 1000  # m to mm
                                result["height"] = item.Depth * 1000
                                return result
        except Exception:
            pass

        # Try from OverallWidth/OverallHeight (common in doors/windows)
        try:
            if hasattr(opening_element, "HasFillings"):
                for rel in opening_element.HasFillings:
                    filling = rel.RelatedBuildingElement
                    if hasattr(filling, "OverallWidth") and filling.OverallWidth:
                        result["width"] = filling.OverallWidth * 1000
                    if hasattr(filling, "OverallHeight") and filling.OverallHeight:
                        result["height"] = filling.OverallHeight * 1000
        except Exception:
            pass

        return result

    def _get_opening_position_relative_to_wall(
        self, opening_element, wall, wall_length_mm: float, wall_height_mm: float
    ) -> dict:
        """Get opening position relative to wall origin."""
        result = {"x": 0, "y": 0}

        try:
            # Get local placement relative to wall
            if opening_element.ObjectPlacement:
                placement = opening_element.ObjectPlacement
                if hasattr(placement, "RelativePlacement") and placement.RelativePlacement:
                    rel = placement.RelativePlacement
                    if hasattr(rel, "Location") and rel.Location:
                        coords = rel.Location.Coordinates
                        result["x"] = abs(coords[0]) * 1000  # m to mm
                        result["y"] = abs(coords[2]) * 1000 if len(coords) > 2 else 0
        except Exception:
            pass

        # Clamp to wall bounds
        result["x"] = max(0, min(result["x"], wall_length_mm))
        result["y"] = max(0, min(result["y"], wall_height_mm))

        return result

    def get_openings(self, ifc_element_id: int) -> list[WallOpening]:
        """Get all stored openings for a wall."""
        return (
            self.db.query(WallOpening)
            .filter(WallOpening.ifc_element_id == ifc_element_id)
            .order_by(WallOpening.position_x_mm)
            .all()
        )

    def add_manual_opening(
        self,
        ifc_element_id: int,
        opening_type: str,
        position_x_mm: float,
        position_y_mm: float,
        width_mm: float,
        height_mm: float,
        rough_opening_width_mm: float | None = None,
        rough_opening_height_mm: float | None = None,
    ) -> WallOpening:
        """Manually add an opening to a wall."""
        clearance = ROUGH_OPENING_CLEARANCE.get(opening_type, {"width": 25, "height": 15})
        if rough_opening_width_mm is None:
            rough_opening_width_mm = width_mm + 2 * clearance["width"]
        if rough_opening_height_mm is None:
            rough_opening_height_mm = height_mm + clearance["height"]

        opening = WallOpening(
            ifc_element_id=ifc_element_id,
            opening_type=opening_type,
            position_x_mm=position_x_mm,
            position_y_mm=position_y_mm,
            width_mm=width_mm,
            height_mm=height_mm,
            rough_opening_width_mm=rough_opening_width_mm,
            rough_opening_height_mm=rough_opening_height_mm,
        )
        self.db.add(opening)
        self.db.commit()
        return opening

    def delete_opening(self, opening_id: int) -> bool:
        opening = self.db.query(WallOpening).filter(WallOpening.id == opening_id).first()
        if not opening:
            return False
        self.db.delete(opening)
        self.db.commit()
        return True
