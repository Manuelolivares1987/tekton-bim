"""Quantity takeoff calculation service."""

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.ifc_element import IfcElement
from app.core.constants import ELEMENT_CATEGORIES


class QuantityTakeoffService:
    """Generates quantity takeoff reports from parsed IFC elements."""

    def __init__(self, db: Session):
        self.db = db

    def generate_takeoff(self, model_id: int) -> dict:
        """Generate full quantity takeoff grouped by category and type."""
        elements = (
            self.db.query(IfcElement)
            .filter(IfcElement.ifc_model_id == model_id)
            .all()
        )

        # Group by ifc_type and type_name
        groups: dict[tuple[str, str | None], list[IfcElement]] = {}
        for el in elements:
            key = (el.ifc_type, el.type_name)
            if key not in groups:
                groups[key] = []
            groups[key].append(el)

        items = []
        for (ifc_type, type_name), group_elements in groups.items():
            category = ELEMENT_CATEGORIES.get(ifc_type, "Other")
            count = len(group_elements)

            total_area = sum(e.gross_area_m2 or 0 for e in group_elements)
            total_volume = sum(e.volume_m3 or 0 for e in group_elements)
            total_length = sum(e.length_m or 0 for e in group_elements)

            items.append({
                "category": category,
                "ifc_type": ifc_type,
                "type_name": type_name or "Unnamed",
                "count": count,
                "total_area_m2": round(total_area, 3) if total_area > 0 else None,
                "total_volume_m3": round(total_volume, 3) if total_volume > 0 else None,
                "total_length_m": round(total_length, 3) if total_length > 0 else None,
            })

        # Sort by category then type
        items.sort(key=lambda x: (x["category"], x["ifc_type"], x["type_name"]))

        total_elements = sum(item["count"] for item in items)

        return {
            "model_id": model_id,
            "items": items,
            "total_elements": total_elements,
        }

    def generate_summary_by_category(self, model_id: int) -> dict:
        """Generate a summary grouped by display category."""
        takeoff = self.generate_takeoff(model_id)

        categories: dict[str, dict] = {}
        for item in takeoff["items"]:
            cat = item["category"]
            if cat not in categories:
                categories[cat] = {
                    "category": cat,
                    "count": 0,
                    "total_area_m2": 0,
                    "total_volume_m3": 0,
                    "total_length_m": 0,
                    "types": [],
                }
            categories[cat]["count"] += item["count"]
            categories[cat]["total_area_m2"] += item["total_area_m2"] or 0
            categories[cat]["total_volume_m3"] += item["total_volume_m3"] or 0
            categories[cat]["total_length_m"] += item["total_length_m"] or 0
            categories[cat]["types"].append(item)

        return {
            "model_id": model_id,
            "categories": list(categories.values()),
            "total_elements": takeoff["total_elements"],
        }

    def export_to_csv(self, model_id: int) -> str:
        """Export quantity takeoff to CSV string."""
        takeoff = self.generate_takeoff(model_id)

        lines = ["Category,IFC Type,Type Name,Count,Area (m2),Volume (m3),Length (m)"]
        for item in takeoff["items"]:
            line = (
                f'"{item["category"]}",'
                f'"{item["ifc_type"]}",'
                f'"{item["type_name"]}",'
                f'{item["count"]},'
                f'{item["total_area_m2"] or ""},'
                f'{item["total_volume_m3"] or ""},'
                f'{item["total_length_m"] or ""}'
            )
            lines.append(line)

        return "\n".join(lines)
