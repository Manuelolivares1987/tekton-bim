"""Constants and mappings for IFC types, materials, and calculations."""

# IFC type to display category mapping
ELEMENT_CATEGORIES: dict[str, str] = {
    "IfcWall": "Walls",
    "IfcWallStandardCase": "Walls",
    "IfcSlab": "Slabs",
    "IfcColumn": "Columns",
    "IfcBeam": "Beams",
    "IfcDoor": "Doors",
    "IfcWindow": "Windows",
    "IfcRoof": "Roofs",
    "IfcStair": "Stairs",
    "IfcRailing": "Railings",
    "IfcCurtainWall": "Curtain Walls",
    "IfcPlate": "Plates",
    "IfcMember": "Members",
    "IfcFooting": "Footings",
    "IfcPile": "Piles",
    "IfcCovering": "Coverings",
    "IfcBuildingElementProxy": "Other Elements",
}

# IFC type to standard Qto property set name
QTO_MAPPING: dict[str, dict] = {
    "IfcWall": {
        "qto": "Qto_WallBaseQuantities",
        "fields": {
            "length": "Length",
            "height": "Height",
            "width": "Width",
            "gross_area": "GrossSideArea",
            "net_area": "NetSideArea",
            "volume": "NetVolume",
        },
    },
    "IfcWallStandardCase": {
        "qto": "Qto_WallBaseQuantities",
        "fields": {
            "length": "Length",
            "height": "Height",
            "width": "Width",
            "gross_area": "GrossSideArea",
            "net_area": "NetSideArea",
            "volume": "NetVolume",
        },
    },
    "IfcSlab": {
        "qto": "Qto_SlabBaseQuantities",
        "fields": {
            "gross_area": "GrossArea",
            "net_area": "NetArea",
            "volume": "NetVolume",
            "width": "Width",
        },
    },
    "IfcColumn": {
        "qto": "Qto_ColumnBaseQuantities",
        "fields": {
            "length": "Length",
            "gross_area": "CrossSectionArea",
            "volume": "NetVolume",
        },
    },
    "IfcBeam": {
        "qto": "Qto_BeamBaseQuantities",
        "fields": {
            "length": "Length",
            "gross_area": "CrossSectionArea",
            "volume": "NetVolume",
        },
    },
    "IfcDoor": {
        "qto": "Qto_DoorBaseQuantities",
        "fields": {
            "height": "Height",
            "width": "Width",
            "gross_area": "Area",
        },
    },
    "IfcWindow": {
        "qto": "Qto_WindowBaseQuantities",
        "fields": {
            "height": "Height",
            "width": "Width",
            "gross_area": "Area",
        },
    },
    "IfcCovering": {
        "qto": "Qto_CoveringBaseQuantities",
        "fields": {
            "gross_area": "GrossArea",
            "net_area": "NetArea",
            "volume": "NetVolume",
        },
    },
    "IfcRoof": {
        "qto": "Qto_RoofBaseQuantities",
        "fields": {
            "gross_area": "GrossArea",
            "net_area": "NetArea",
            "volume": "NetVolume",
        },
    },
}

# Volcanic rock (lana de roca) density presets in kg/m3
ROCK_WOOL_DENSITIES: dict[str, float] = {
    "low_density": 40.0,       # Flexible rolls
    "medium_density": 80.0,    # Semi-rigid batts
    "high_density": 120.0,     # Rigid boards
    "extra_high_density": 150.0,  # Industrial/fire-rated
}

# Standard insulation thicknesses in mm
STANDARD_THICKNESSES: list[float] = [25.0, 40.0, 50.0, 60.0, 80.0, 100.0, 120.0, 150.0]
