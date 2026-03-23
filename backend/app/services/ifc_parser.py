"""IFC file parsing service using IfcOpenShell."""

import json
import time
from datetime import UTC, datetime

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as element_util
from sqlalchemy.orm import Session

from app.core.constants import QTO_MAPPING
from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel


class IfcParser:
    """Wraps IfcOpenShell operations for parsing IFC files."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.model = ifcopenshell.open(file_path)
        self.settings = ifcopenshell.geom.settings()

    def get_project_info(self) -> dict:
        """Extract IfcProject metadata."""
        project = self.model.by_type("IfcProject")
        if not project:
            return {}
        project = project[0]
        return {
            "name": project.Name or "",
            "description": project.Description or "",
            "schema": self.model.schema,
        }

    def get_spatial_hierarchy(self) -> dict:
        """Build spatial tree: IfcProject -> IfcSite -> IfcBuilding -> IfcStorey."""
        hierarchy = {"project": None, "sites": []}
        projects = self.model.by_type("IfcProject")
        if not projects:
            return hierarchy

        project = projects[0]
        hierarchy["project"] = {"name": project.Name, "id": project.GlobalId}

        for site in self.model.by_type("IfcSite"):
            site_data = {"name": site.Name or "Site", "id": site.GlobalId, "buildings": []}
            for building in self.model.by_type("IfcBuilding"):
                building_data = {
                    "name": building.Name or "Building",
                    "id": building.GlobalId,
                    "storeys": [],
                }
                for storey in self.model.by_type("IfcBuildingStorey"):
                    storey_data = {
                        "name": storey.Name or "Storey",
                        "id": storey.GlobalId,
                        "elevation": storey.Elevation,
                    }
                    building_data["storeys"].append(storey_data)
                site_data["buildings"].append(building_data)
            hierarchy["sites"].append(site_data)

        return hierarchy

    def get_storey_for_element(self, element) -> str | None:
        """Find which IfcBuildingStorey contains this element."""
        try:
            container = ifcopenshell.util.element.get_container(element)
            if container and container.is_a("IfcBuildingStorey"):
                return container.Name
        except Exception:
            pass
        return None

    def get_type_name(self, element) -> str | None:
        """Get the type product name for an element."""
        try:
            element_type = ifcopenshell.util.element.get_type(element)
            if element_type:
                return element_type.Name
        except Exception:
            pass
        return None

    def extract_quantities(self, element) -> dict:
        """Extract quantities from Qto property sets, fallback to geometry."""
        ifc_type = element.is_a()
        result = {
            "length_m": None,
            "height_m": None,
            "width_m": None,
            "gross_area_m2": None,
            "net_area_m2": None,
            "volume_m3": None,
        }

        # Try Qto property sets first
        qto_info = QTO_MAPPING.get(ifc_type)
        if qto_info:
            try:
                qtos = element_util.get_psets(element, qtos_only=True)
                qto_data = qtos.get(qto_info["qto"], {})
                fields = qto_info["fields"]

                for key, qto_field in fields.items():
                    value = qto_data.get(qto_field)
                    if value is not None and value > 0:
                        result[key] = float(value)
            except Exception:
                pass

        # Fallback to geometry for missing values
        if any(v is None for v in [result["gross_area_m2"], result["volume_m3"]]):
            try:
                shape = ifcopenshell.geom.create_shape(self.settings, element)
                if shape and shape.geometry:
                    geo = shape.geometry
                    verts = geo.verts
                    if verts and len(verts) > 0:
                        # Compute bounding box for dimensions
                        xs = verts[0::3]
                        ys = verts[1::3]
                        zs = verts[2::3]
                        if xs:
                            if result["length_m"] is None:
                                result["length_m"] = max(xs) - min(xs)
                            if result["width_m"] is None:
                                result["width_m"] = max(ys) - min(ys)
                            if result["height_m"] is None:
                                result["height_m"] = max(zs) - min(zs)

                        # Approximate area from bounding box if still missing
                        if result["gross_area_m2"] is None and result["length_m"] and result["height_m"]:
                            result["gross_area_m2"] = result["length_m"] * result["height_m"]

                        if result["net_area_m2"] is None:
                            result["net_area_m2"] = result["gross_area_m2"]

                        # Approximate volume from bounding box
                        if (result["volume_m3"] is None and
                                result["length_m"] and result["width_m"] and result["height_m"]):
                            result["volume_m3"] = result["length_m"] * result["width_m"] * result["height_m"]
            except Exception:
                pass

        return result

    def extract_properties(self, element) -> dict:
        """Extract all property sets as a dictionary."""
        try:
            psets = element_util.get_psets(element)
            # Convert to JSON-safe format
            safe_psets = {}
            for pset_name, pset_data in psets.items():
                safe_psets[pset_name] = {}
                for key, value in pset_data.items():
                    if key == "id":
                        continue
                    try:
                        json.dumps(value)
                        safe_psets[pset_name][key] = value
                    except (TypeError, ValueError):
                        safe_psets[pset_name][key] = str(value)
            return safe_psets
        except Exception:
            return {}

    def get_all_building_elements(self) -> list:
        """Get all IfcBuildingElement instances."""
        elements = []
        for element in self.model.by_type("IfcBuildingElement"):
            elements.append(element)
        return elements


class IfcParsingService:
    """High-level service for IFC import and parsing."""

    def __init__(self, db: Session):
        self.db = db

    def import_and_parse(self, project_id: int, file_name: str,
                         file_path: str, file_size: int) -> dict:
        """Import an IFC file, parse it, and store elements in the database."""
        start_time = time.time()

        # Create IFC model record
        ifc_model = IfcModel(
            project_id=project_id,
            file_name=file_name,
            file_path=file_path,
            file_size_bytes=file_size,
        )
        self.db.add(ifc_model)
        self.db.flush()

        # Parse the file
        parser = IfcParser(file_path)
        project_info = parser.get_project_info()
        ifc_model.ifc_schema = project_info.get("schema", "")
        ifc_model.authoring_tool = ""

        # Extract all building elements
        building_elements = parser.get_all_building_elements()
        element_count = 0

        for element in building_elements:
            try:
                quantities = parser.extract_quantities(element)
                properties = parser.extract_properties(element)
                storey_name = parser.get_storey_for_element(element)
                type_name = parser.get_type_name(element)

                ifc_element = IfcElement(
                    ifc_model_id=ifc_model.id,
                    global_id=element.GlobalId,
                    ifc_type=element.is_a(),
                    name=element.Name,
                    description=getattr(element, "Description", None),
                    storey_name=storey_name,
                    type_name=type_name,
                    length_m=quantities.get("length_m"),
                    height_m=quantities.get("height_m"),
                    width_m=quantities.get("width_m"),
                    gross_area_m2=quantities.get("gross_area_m2"),
                    net_area_m2=quantities.get("net_area_m2"),
                    volume_m3=quantities.get("volume_m3"),
                    properties_json=json.dumps(properties) if properties else None,
                )
                self.db.add(ifc_element)
                element_count += 1
            except Exception:
                continue

        ifc_model.element_count = element_count
        ifc_model.parsed_at = datetime.now(UTC)
        self.db.commit()

        parse_time = time.time() - start_time

        return {
            "model_id": ifc_model.id,
            "element_count": element_count,
            "parse_time_seconds": round(parse_time, 2),
        }

    def get_model_summary(self, model_id: int) -> dict:
        """Get a summary of an imported IFC model."""
        model = self.db.query(IfcModel).filter(IfcModel.id == model_id).first()
        if not model:
            return {}

        elements = self.db.query(IfcElement).filter(IfcElement.ifc_model_id == model_id).all()

        # Count by type
        elements_by_type: dict[str, int] = {}
        storeys: set[str] = set()
        for el in elements:
            elements_by_type[el.ifc_type] = elements_by_type.get(el.ifc_type, 0) + 1
            if el.storey_name:
                storeys.add(el.storey_name)

        return {
            "model_id": model.id,
            "file_name": model.file_name,
            "ifc_schema": model.ifc_schema,
            "element_count": model.element_count,
            "elements_by_type": elements_by_type,
            "storeys": sorted(storeys),
        }

    def get_elements(self, model_id: int, ifc_type: str | None = None,
                     storey: str | None = None, page: int = 1,
                     limit: int = 50) -> tuple[list[IfcElement], int]:
        """Get elements with optional filtering and pagination."""
        query = self.db.query(IfcElement).filter(IfcElement.ifc_model_id == model_id)

        if ifc_type:
            query = query.filter(IfcElement.ifc_type == ifc_type)
        if storey:
            query = query.filter(IfcElement.storey_name == storey)

        total = query.count()
        elements = query.offset((page - 1) * limit).limit(limit).all()
        return elements, total
