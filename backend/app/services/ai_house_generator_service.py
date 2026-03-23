"""AI House Generator - generates complete houses from natural language prompts.

Flow:
1. User gives prompt: "Casa 80m², 3 dormitorios, zona sísmica 3"
2. Claude generates a HouseSpec JSON with all walls and openings
3. Service creates the project using BimWallService
4. Returns complete project with panels, framing, and cost estimate
"""

from anthropic import Anthropic
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.building_rules import DEFAULT_PRICES_CLP, get_full_rules_context
from app.services.bim_modular_service import BimModularService
from app.services.bim_wall_service import BimWallService
from app.services.code_knowledge_service import CodeKnowledgeService

# ── Schemas for Claude's structured output ──

class OpeningSpec(BaseModel):
    opening_type: str  # "door" | "window"
    position_along_mm: float
    position_y_mm: float = 0.0
    width_mm: float
    height_mm: float

class WallSpec(BaseModel):
    start_x_mm: float
    start_z_mm: float
    end_x_mm: float
    end_z_mm: float
    height_mm: float = 2440.0
    storey_index: int = 0
    openings: list[OpeningSpec] = []

class StoreySpec(BaseModel):
    name: str
    elevation_mm: float = 0.0
    floor_height_mm: float = 2440.0

class HouseSpec(BaseModel):
    name: str
    description: str
    storeys: list[StoreySpec]
    walls: list[WallSpec]
    total_area_m2: float
    rooms: list[dict] = []  # [{name, area_m2, walls}]
    design_notes: str = ""


SYSTEM_PROMPT_TEMPLATE = """Eres un arquitecto e ingeniero estructural experto en construcción con paneles SIP (Structural Insulated Panels) y entramado de madera.

Tu trabajo es diseñar casas completas a partir de descripciones en lenguaje natural. Debes generar un JSON con la especificación exacta de todos los muros y aberturas.

{rules}

## Instrucciones de Diseño
1. Diseña la planta considerando circulación eficiente y recintos bien proporcionados
2. Orienta los dormitorios idealmente al norte/este (hemisferio sur)
3. Coloca baños cerca de la cocina para optimizar instalaciones sanitarias
4. Incluye puertas en TODOS los recintos cerrados (dormitorios, baños)
5. Incluye ventanas según normativa (min 10% superficie de piso)
6. Las puertas se colocan a position_y_mm=0 (desde el piso)
7. Las ventanas se colocan a position_y_mm=900 (alféizar a 900mm)
8. Puerta de acceso: 900x2100mm. Puertas interiores: 800x2050mm
9. Ventanas dormitorio: 1200x1200mm. Ventana baño: 600x600mm a 1500mm altura
10. Los muros DEBEN cerrar formando recintos (las esquinas deben coincidir)
11. Usa coordenadas en milímetros, con origen (0,0) en esquina superior-izquierda
12. Los muros exteriores tienen espesor 136mm (SIP). Interiores: 136mm también
13. position_along_mm es la distancia desde el punto START del muro donde comienza la abertura

## Formato de Respuesta
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con esta estructura:
{{
  "name": "nombre del proyecto",
  "description": "descripción breve",
  "storeys": [{{"name": "Piso 1", "elevation_mm": 0, "floor_height_mm": 2440}}],
  "walls": [
    {{
      "start_x_mm": 0, "start_z_mm": 0,
      "end_x_mm": 5000, "end_z_mm": 0,
      "height_mm": 2440, "storey_index": 0,
      "openings": [
        {{"opening_type": "window", "position_along_mm": 1500, "position_y_mm": 900, "width_mm": 1200, "height_mm": 1200}}
      ]
    }}
  ],
  "total_area_m2": 80.0,
  "rooms": [{{"name": "Dormitorio Principal", "area_m2": 14.0}}],
  "design_notes": "notas de diseño"
}}"""


class AiHouseGeneratorService:
    def __init__(self, db: Session):
        self.db = db
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.wall_service = BimWallService(db)
        self.code_service = CodeKnowledgeService(db)

    def generate_preview(
        self,
        prompt: str,
        seismic_zone: int = 2,
        country: str = "chile",
        floors: int = 1,
    ) -> HouseSpec:
        """Generate a house spec from a prompt WITHOUT creating anything in DB."""
        # Base rules
        rules = get_full_rules_context(seismic_zone, country)

        # RAG: retrieve country-specific normativas from knowledge base
        rag_context = self.code_service.get_context_for_generation(
            country=country,
            topics=["seismic", "structural_walls", "dimensions", "openings", "insulation"],
        )
        if rag_context:
            rules += f"\n\n## Normativa Específica del País ({country.upper()})\n{rag_context}"

        system = SYSTEM_PROMPT_TEMPLATE.format(rules=rules)

        if floors > 1:
            prompt += f"\n\nLa casa debe tener {floors} pisos."

        response = self.client.messages.create(
            model=settings.claude_model,
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        # Handle potential markdown wrapping
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        spec = HouseSpec.model_validate_json(raw)
        return spec

    def commit_house(self, project_id: int, spec: HouseSpec) -> dict:
        """Create the actual BIM model from a HouseSpec."""
        modular_svc = BimModularService(self.db)

        # Create storeys
        storey_ids = []
        for s in spec.storeys:
            storey = modular_svc.add_storey(
                project_id, s.name, s.elevation_mm, s.floor_height_mm
            )
            storey_ids.append(storey.id)

        # Create walls with openings
        wall_results = []
        for wall_spec in spec.walls:
            storey_id = None
            if wall_spec.storey_index < len(storey_ids):
                storey_id = storey_ids[wall_spec.storey_index]

            result = self.wall_service.draw_wall(
                project_id=project_id,
                start_x_mm=wall_spec.start_x_mm,
                start_z_mm=wall_spec.start_z_mm,
                end_x_mm=wall_spec.end_x_mm,
                end_z_mm=wall_spec.end_z_mm,
                storey_id=storey_id,
                height_mm=wall_spec.height_mm,
            )

            wall_id = result["wall"]["id"]

            # Add openings
            for op in wall_spec.openings:
                self.wall_service.add_opening(
                    wall_id=wall_id,
                    opening_type=op.opening_type,
                    position_along_mm=op.position_along_mm,
                    position_y_mm=op.position_y_mm,
                    width_mm=op.width_mm,
                    height_mm=op.height_mm,
                )

            # Re-fetch final assembly
            assembly = self.wall_service.get_wall_assembly(wall_id)
            wall_results.append(assembly)

        # Calculate cost estimate
        cost = self._estimate_cost(wall_results, spec)

        return {
            "project_id": project_id,
            "spec": spec.model_dump(),
            "walls": [r["wall"] for r in wall_results],
            "total_panels": sum(len(r["panels"]) for r in wall_results),
            "total_framing": sum(len(r["framing"]) for r in wall_results),
            "cost_estimate": cost,
        }

    def generate_and_commit(
        self,
        project_id: int,
        prompt: str,
        seismic_zone: int = 2,
        country: str = "chile",
        floors: int = 1,
    ) -> dict:
        """Generate house spec and create the BIM model in one step."""
        spec = self.generate_preview(prompt, seismic_zone, country, floors)
        return self.commit_house(project_id, spec)

    def _estimate_cost(self, wall_results: list[dict], spec: HouseSpec) -> dict:
        """Calculate cost estimate from generated walls."""
        prices = DEFAULT_PRICES_CLP

        # Count panels
        total_panels = 0
        total_panel_area_m2 = 0
        total_studs = 0
        total_plates = 0
        total_headers = 0
        total_doors = 0
        total_windows = 0

        for wr in wall_results:
            for panel in wr["panels"]:
                total_panels += 1
                area = (panel["width_mm"] / 1000) * (panel["height_mm"] / 1000)
                total_panel_area_m2 += area
                if panel.get("has_opening"):
                    if panel.get("opening_type") == "door":
                        total_doors += 1
                    else:
                        total_windows += 1

            for member in wr["framing"]:
                mt = member["member_type"]
                if "plate" in mt:
                    total_plates += member.get("quantity", 1)
                elif "header" in mt:
                    total_headers += member.get("quantity", 1)
                elif "stud" in mt:
                    total_studs += member.get("quantity", 1)

        # Calculate costs
        items = []

        # SIP panels
        panel_cost = round(total_panel_area_m2 * prices["sip_panel_custom_m2"]["price"])
        items.append({
            "category": "Paneles SIP",
            "description": f"{total_panels} paneles ({total_panel_area_m2:.1f} m²)",
            "quantity": total_panel_area_m2,
            "unit": "m²",
            "unit_price": prices["sip_panel_custom_m2"]["price"],
            "total": panel_cost,
        })

        # Lumber (studs + plates)
        lumber_units = total_studs + total_plates + total_headers * 2
        lumber_cost = lumber_units * prices["lumber_2x4_3m"]["price"]
        items.append({
            "category": "Madera Estructural",
            "description": f"{lumber_units} piezas (studs, soleras, dinteles)",
            "quantity": lumber_units,
            "unit": "un",
            "unit_price": prices["lumber_2x4_3m"]["price"],
            "total": lumber_cost,
        })

        # Windows
        if total_windows > 0:
            win_cost = total_windows * prices["window_standard_1200x1200"]["price"]
            items.append({
                "category": "Ventanas",
                "description": f"{total_windows} ventanas DVH",
                "quantity": total_windows,
                "unit": "un",
                "unit_price": prices["window_standard_1200x1200"]["price"],
                "total": win_cost,
            })

        # Doors
        if total_doors > 0:
            door_cost = total_doors * prices["door_interior_800x2000"]["price"]
            items.append({
                "category": "Puertas",
                "description": f"{total_doors} puertas",
                "quantity": total_doors,
                "unit": "un",
                "unit_price": prices["door_interior_800x2000"]["price"],
                "total": door_cost,
            })

        # Foundation
        foundation_cost = round(spec.total_area_m2 * prices["foundation_radier_m2"]["price"])
        items.append({
            "category": "Fundaciones",
            "description": f"Radier {spec.total_area_m2:.0f} m²",
            "quantity": spec.total_area_m2,
            "unit": "m²",
            "unit_price": prices["foundation_radier_m2"]["price"],
            "total": foundation_cost,
        })

        # Roof
        roof_area = spec.total_area_m2 * 1.15  # 15% extra for overhangs
        roof_cost = round(roof_area * prices["roof_shingle_m2"]["price"])
        items.append({
            "category": "Techumbre",
            "description": f"Teja asfáltica {roof_area:.0f} m²",
            "quantity": roof_area,
            "unit": "m²",
            "unit_price": prices["roof_shingle_m2"]["price"],
            "total": roof_cost,
        })

        # Labor
        labor_cost = round(spec.total_area_m2 * prices["labor_construction_m2"]["price"])
        items.append({
            "category": "Mano de Obra",
            "description": f"Construcción {spec.total_area_m2:.0f} m²",
            "quantity": spec.total_area_m2,
            "unit": "m²",
            "unit_price": prices["labor_construction_m2"]["price"],
            "total": labor_cost,
        })

        # Transport
        items.append({
            "category": "Transporte",
            "description": "Transporte de materiales",
            "quantity": 1,
            "unit": "gl",
            "unit_price": prices["transport_flat"]["price"],
            "total": prices["transport_flat"]["price"],
        })

        subtotal = sum(i["total"] for i in items)
        iva = round(subtotal * 0.19)  # 19% IVA Chile
        total = subtotal + iva

        return {
            "currency": "CLP",
            "items": items,
            "subtotal": subtotal,
            "iva": iva,
            "total": total,
            "price_per_m2": round(total / spec.total_area_m2) if spec.total_area_m2 > 0 else 0,
            "rooms": spec.rooms,
        }
