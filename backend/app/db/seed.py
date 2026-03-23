"""Seed database with default materials and panel types."""

from sqlalchemy.orm import Session

from app.models.material import Material
from app.models.panel import Panel
from app.models.panel_layer import PanelLayer

DEFAULT_MATERIALS = [
    # Structural
    {"name": "Steel Stud (light gauge)", "category": "structural", "density_kg_m3": 7850, "thermal_conductivity_w_mk": 50.0, "description": "Light gauge steel framing"},
    {"name": "Wood Stud (SPF)", "category": "structural", "density_kg_m3": 500, "thermal_conductivity_w_mk": 0.12, "description": "Spruce-Pine-Fir lumber"},
    {"name": "Concrete", "category": "structural", "density_kg_m3": 2400, "thermal_conductivity_w_mk": 1.7, "description": "Normal weight concrete"},

    # Finish
    {"name": "Gypsum Board (12.7mm)", "category": "finish", "density_kg_m3": 800, "thermal_conductivity_w_mk": 0.16, "description": "Standard 1/2 inch drywall"},
    {"name": "Gypsum Board (15.9mm)", "category": "finish", "density_kg_m3": 800, "thermal_conductivity_w_mk": 0.16, "description": "5/8 inch type X fire-rated drywall"},
    {"name": "Cement Board", "category": "finish", "density_kg_m3": 1150, "thermal_conductivity_w_mk": 0.25, "description": "Fiber cement board for wet areas"},
    {"name": "Plywood (12mm)", "category": "finish", "density_kg_m3": 550, "thermal_conductivity_w_mk": 0.13, "description": "Structural plywood sheathing"},

    # Insulation - Volcanic Rock (Lana de Roca)
    {"name": "Volcanic Rock - Low Density (40 kg/m3)", "category": "insulation", "density_kg_m3": 40, "thermal_conductivity_w_mk": 0.038, "description": "Flexible roll insulation", "is_volcanic_rock": True},
    {"name": "Volcanic Rock - Medium Density (80 kg/m3)", "category": "insulation", "density_kg_m3": 80, "thermal_conductivity_w_mk": 0.036, "description": "Semi-rigid batt insulation", "is_volcanic_rock": True},
    {"name": "Volcanic Rock - High Density (120 kg/m3)", "category": "insulation", "density_kg_m3": 120, "thermal_conductivity_w_mk": 0.035, "description": "Rigid board insulation", "is_volcanic_rock": True},
    {"name": "Volcanic Rock - Extra High Density (150 kg/m3)", "category": "insulation", "density_kg_m3": 150, "thermal_conductivity_w_mk": 0.034, "description": "Industrial/fire-rated insulation", "is_volcanic_rock": True},

    # Other insulation
    {"name": "Fiberglass Batt", "category": "insulation", "density_kg_m3": 12, "thermal_conductivity_w_mk": 0.040, "description": "Standard fiberglass batt insulation"},
    {"name": "EPS (Expanded Polystyrene)", "category": "insulation", "density_kg_m3": 20, "thermal_conductivity_w_mk": 0.035, "description": "EPS rigid foam board"},
    {"name": "XPS (Extruded Polystyrene)", "category": "insulation", "density_kg_m3": 35, "thermal_conductivity_w_mk": 0.029, "description": "XPS rigid foam board"},

    # Membranes
    {"name": "Vapor Barrier (PE)", "category": "membrane", "density_kg_m3": 950, "thermal_conductivity_w_mk": 0.33, "description": "Polyethylene vapor barrier"},
    {"name": "House Wrap (WRB)", "category": "membrane", "density_kg_m3": 400, "thermal_conductivity_w_mk": 0.25, "description": "Weather-resistant barrier"},

    # Exterior
    {"name": "Fiber Cement Siding", "category": "exterior", "density_kg_m3": 1400, "thermal_conductivity_w_mk": 0.25, "description": "Exterior fiber cement cladding"},
    {"name": "Brick Veneer", "category": "exterior", "density_kg_m3": 1800, "thermal_conductivity_w_mk": 0.72, "description": "Clay brick veneer"},
    {"name": "Stucco (EIFS)", "category": "exterior", "density_kg_m3": 1900, "thermal_conductivity_w_mk": 0.72, "description": "Exterior insulation and finish system"},

    # SIP Panel Materials
    {"name": "OSB 11mm", "category": "sheathing", "density_kg_m3": 640, "thermal_conductivity_w_mk": 0.13, "cost_per_unit": 8.5, "cost_unit": "m2", "description": "Oriented strand board 11mm for SIP skins"},
    {"name": "OSB 15mm", "category": "sheathing", "density_kg_m3": 640, "thermal_conductivity_w_mk": 0.13, "cost_per_unit": 12.0, "cost_unit": "m2", "description": "Oriented strand board 15mm for SIP skins"},
    {"name": "Polyurethane Foam (PUR)", "category": "insulation", "density_kg_m3": 32, "thermal_conductivity_w_mk": 0.024, "cost_per_unit": 45.0, "cost_unit": "m3", "description": "Rigid polyurethane foam for SIP cores"},
    {"name": "SIP Spline (OSB)", "category": "connector", "density_kg_m3": 640, "thermal_conductivity_w_mk": 0.13, "cost_per_unit": 2.5, "cost_unit": "ml", "description": "OSB spline for SIP panel joints"},
    {"name": "Cam-Lock Hardware", "category": "hardware", "density_kg_m3": 7850, "cost_per_unit": 15.0, "cost_unit": "unit", "description": "Cam-lock connector for SIP panel joints"},
    {"name": "SIP Adhesive", "category": "adhesive", "density_kg_m3": 1100, "cost_per_unit": 8.0, "cost_unit": "kg", "description": "Structural adhesive for SIP panel assembly"},
    {"name": "SIP Screws (structural)", "category": "hardware", "density_kg_m3": 7850, "cost_per_unit": 0.15, "cost_unit": "unit", "description": "Structural screws for SIP panel fastening"},
]


def seed_materials(db: Session):
    """Seed default materials if not already present."""
    existing = db.query(Material).count()
    if existing > 0:
        return

    for mat_data in DEFAULT_MATERIALS:
        material = Material(**mat_data)
        db.add(material)

    db.commit()


def seed_default_panels(db: Session):
    """Seed some common panel type templates."""
    existing = db.query(Panel).count()
    if existing > 0:
        return

    # Get material IDs
    gypsum_12 = db.query(Material).filter(Material.name.like("Gypsum Board (12.7%")).first()
    gypsum_15 = db.query(Material).filter(Material.name.like("Gypsum Board (15.9%")).first()
    steel_stud = db.query(Material).filter(Material.name.like("Steel Stud%")).first()
    volcanic_80 = db.query(Material).filter(Material.name.like("Volcanic Rock - Medium%")).first()
    house_wrap = db.query(Material).filter(Material.name.like("House Wrap%")).first()
    cement_siding = db.query(Material).filter(Material.name.like("Fiber Cement Siding%")).first()

    if not all([gypsum_12, steel_stud, volcanic_80]):
        return

    # Interior Partition (steel stud with gypsum)
    partition = Panel(
        name="Standard Interior Partition",
        category="partition",
        description="92mm steel stud partition with 12.7mm gypsum each side",
        volcanic_rock_kg_per_unit=3.2,
    )
    db.add(partition)
    db.flush()

    layers = [
        PanelLayer(panel_id=partition.id, material_id=gypsum_12.id, layer_order=1, thickness_mm=12.7, description="Interior face"),
        PanelLayer(panel_id=partition.id, material_id=steel_stud.id, layer_order=2, thickness_mm=92.0, description="Steel stud cavity"),
        PanelLayer(panel_id=partition.id, material_id=volcanic_80.id, layer_order=3, thickness_mm=80.0, description="Volcanic rock insulation"),
        PanelLayer(panel_id=partition.id, material_id=gypsum_12.id, layer_order=4, thickness_mm=12.7, description="Interior face"),
    ]
    for layer in layers:
        db.add(layer)

    # Exterior Wall
    if cement_siding and house_wrap:
        exterior = Panel(
            name="Standard Exterior Wall",
            category="exterior_wall",
            description="Steel stud exterior wall with volcanic rock insulation and cement siding",
            volcanic_rock_kg_per_unit=8.0,
        )
        db.add(exterior)
        db.flush()

        ext_layers = [
            PanelLayer(panel_id=exterior.id, material_id=cement_siding.id, layer_order=1, thickness_mm=8.0, description="Exterior cladding"),
            PanelLayer(panel_id=exterior.id, material_id=house_wrap.id, layer_order=2, thickness_mm=0.5, description="Weather barrier"),
            PanelLayer(panel_id=exterior.id, material_id=steel_stud.id, layer_order=3, thickness_mm=152.0, description="Steel stud cavity"),
            PanelLayer(panel_id=exterior.id, material_id=volcanic_80.id, layer_order=4, thickness_mm=100.0, description="Volcanic rock insulation"),
            PanelLayer(panel_id=exterior.id, material_id=gypsum_15.id if gypsum_15 else gypsum_12.id, layer_order=5, thickness_mm=15.9, description="Interior finish"),
        ]
        for layer in ext_layers:
            db.add(layer)

    # Fire-rated Partition
    if gypsum_15:
        fire_rated = Panel(
            name="1-Hour Fire-Rated Partition",
            category="partition",
            description="Fire-rated partition with double 15.9mm type X gypsum each side",
            volcanic_rock_kg_per_unit=9.6,
        )
        db.add(fire_rated)
        db.flush()

        fire_layers = [
            PanelLayer(panel_id=fire_rated.id, material_id=gypsum_15.id, layer_order=1, thickness_mm=15.9, description="Outer gypsum layer"),
            PanelLayer(panel_id=fire_rated.id, material_id=gypsum_15.id, layer_order=2, thickness_mm=15.9, description="Inner gypsum layer"),
            PanelLayer(panel_id=fire_rated.id, material_id=steel_stud.id, layer_order=3, thickness_mm=92.0, description="Steel stud cavity"),
            PanelLayer(panel_id=fire_rated.id, material_id=volcanic_80.id, layer_order=4, thickness_mm=80.0, description="Volcanic rock insulation"),
            PanelLayer(panel_id=fire_rated.id, material_id=gypsum_15.id, layer_order=5, thickness_mm=15.9, description="Inner gypsum layer"),
            PanelLayer(panel_id=fire_rated.id, material_id=gypsum_15.id, layer_order=6, thickness_mm=15.9, description="Outer gypsum layer"),
        ]
        for layer in fire_layers:
            db.add(layer)

    db.commit()


def seed_panel_catalog(db: Session):
    """Seed default SIP panel catalog for BIM modeler."""
    from app.models.panel_catalog import PanelCatalog

    existing = db.query(PanelCatalog).count()
    if existing > 0:
        return

    catalogs = [
        {"name": "SIP 1220x2440 EPS114", "category": "full", "width_mm": 1220, "height_mm": 2440, "thickness_mm": 136, "core_thickness_mm": 114, "skin_thickness_mm": 11},
        {"name": "SIP 610x2440 EPS114", "category": "half", "width_mm": 610, "height_mm": 2440, "thickness_mm": 136, "core_thickness_mm": 114, "skin_thickness_mm": 11},
        {"name": "SIP 1220x2740 EPS114", "category": "full", "width_mm": 1220, "height_mm": 2740, "thickness_mm": 136, "core_thickness_mm": 114, "skin_thickness_mm": 11},
        {"name": "SIP 1220x3050 EPS114", "category": "full", "width_mm": 1220, "height_mm": 3050, "thickness_mm": 136, "core_thickness_mm": 114, "skin_thickness_mm": 11},
        {"name": "SIP 1220x2440 EPS89", "category": "full", "width_mm": 1220, "height_mm": 2440, "thickness_mm": 111, "core_thickness_mm": 89, "skin_thickness_mm": 11},
        {"name": "SIP 1220x2440 EPS165", "category": "full", "width_mm": 1220, "height_mm": 2440, "thickness_mm": 187, "core_thickness_mm": 165, "skin_thickness_mm": 11},
    ]

    for cat_data in catalogs:
        area = (cat_data["width_mm"] / 1000) * (cat_data["height_mm"] / 1000)
        skin_w = 2 * area * (cat_data["skin_thickness_mm"] / 1000) * 640
        core_w = area * (cat_data["core_thickness_mm"] / 1000) * 20
        cat_data["weight_kg"] = round(skin_w + core_w, 2)
        db.add(PanelCatalog(**cat_data))

    db.commit()


def seed_all(db: Session):
    """Run all seed functions."""
    seed_materials(db)
    seed_default_panels(db)
    seed_panel_catalog(db)
