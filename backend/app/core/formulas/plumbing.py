"""Plumbing engineering calculation formulas (IPC/UPC-based)."""

import math

# Fixture unit values per UPC/IPC
FIXTURE_UNITS: dict[str, dict] = {
    "water_closet_tank": {"fu": 2.5, "drain_mm": 75.0},
    "water_closet_valve": {"fu": 6.0, "drain_mm": 75.0},
    "lavatory": {"fu": 1.0, "drain_mm": 32.0},
    "bathtub": {"fu": 2.0, "drain_mm": 38.0},
    "shower": {"fu": 2.0, "drain_mm": 50.0},
    "kitchen_sink": {"fu": 1.5, "drain_mm": 38.0},
    "dishwasher": {"fu": 1.5, "drain_mm": 38.0},
    "washing_machine": {"fu": 2.0, "drain_mm": 50.0},
    "hose_bibb": {"fu": 2.5, "drain_mm": None},
    "floor_drain": {"fu": 1.0, "drain_mm": 50.0},
    "urinal": {"fu": 2.0, "drain_mm": 50.0},
    "utility_sink": {"fu": 2.0, "drain_mm": 38.0},
}

# Modified Hunter's Curve lookup table: total FU -> GPM
HUNTER_CURVE: list[tuple[float, float]] = [
    (1, 1.0), (2, 2.0), (3, 3.0), (5, 5.0), (6, 5.5),
    (8, 6.5), (10, 8.0), (12, 9.0), (15, 10.5), (18, 11.5),
    (20, 12.8), (25, 14.0), (30, 15.3), (35, 16.2), (40, 17.0),
    (45, 18.0), (50, 18.8), (60, 20.0), (70, 21.0), (80, 22.0),
    (90, 22.8), (100, 23.6), (120, 25.2), (150, 27.2), (180, 29.0),
    (200, 30.0), (250, 32.5), (300, 35.0), (400, 38.0), (500, 41.0),
    (750, 48.0), (1000, 55.0), (1500, 65.0), (2000, 75.0),
]

# Hazen-Williams coefficients by pipe material
HAZEN_WILLIAMS_C: dict[str, float] = {
    "copper": 150.0,
    "pex": 140.0,
    "cpvc": 140.0,
    "pvc": 150.0,
    "galvanized_steel": 120.0,
    "cast_iron": 100.0,
}

# Standard pipe sizes: nominal -> internal diameter (inches) for copper type L
PIPE_SIZES_COPPER: list[tuple[str, float]] = [
    ("3/8", 0.430),
    ("1/2", 0.545),
    ("3/4", 0.785),
    ("1", 1.025),
    ("1-1/4", 1.265),
    ("1-1/2", 1.505),
    ("2", 1.985),
    ("2-1/2", 2.465),
    ("3", 2.945),
    ("4", 3.905),
]

# Minimum pressure requirements at fixtures (psi)
FIXTURE_MIN_PRESSURE: dict[str, float] = {
    "water_closet_tank": 8.0,
    "water_closet_valve": 15.0,
    "lavatory": 8.0,
    "bathtub": 8.0,
    "shower": 8.0,
    "kitchen_sink": 8.0,
    "dishwasher": 8.0,
    "washing_machine": 8.0,
    "hose_bibb": 8.0,
}


def get_fixture_units(fixture_type: str) -> float:
    """Get fixture unit value for a given fixture type."""
    fixture = FIXTURE_UNITS.get(fixture_type)
    if fixture is None:
        return 1.0
    return fixture["fu"]


def get_drain_size(fixture_type: str) -> float | None:
    """Get minimum drain size in mm for a fixture type."""
    fixture = FIXTURE_UNITS.get(fixture_type)
    if fixture is None:
        return None
    return fixture["drain_mm"]


def fixture_units_to_gpm(total_fu: float) -> float:
    """Convert total fixture units to GPM using Modified Hunter's Curve.
    Interpolates between table values.
    """
    if total_fu <= 0:
        return 0.0

    # Find the two surrounding points
    prev_fu, prev_gpm = HUNTER_CURVE[0]
    if total_fu <= prev_fu:
        return prev_gpm

    for fu, gpm in HUNTER_CURVE:
        if total_fu <= fu:
            # Linear interpolation
            ratio = (total_fu - prev_fu) / (fu - prev_fu) if fu != prev_fu else 0
            return prev_gpm + ratio * (gpm - prev_gpm)
        prev_fu, prev_gpm = fu, gpm

    # Extrapolate beyond table (linear from last two points)
    last_fu, last_gpm = HUNTER_CURVE[-1]
    prev_fu2, prev_gpm2 = HUNTER_CURVE[-2]
    slope = (last_gpm - prev_gpm2) / (last_fu - prev_fu2)
    return last_gpm + slope * (total_fu - last_fu)


def calculate_velocity(flow_gpm: float, internal_diameter_inches: float) -> float:
    """Calculate flow velocity in ft/s.
    v = 0.4085 * GPM / d^2
    """
    if internal_diameter_inches <= 0:
        return 0.0
    return 0.4085 * flow_gpm / (internal_diameter_inches ** 2)


def size_pipe(flow_gpm: float, velocity_target_fps: float = 5.0,
              pipe_material: str = "copper") -> tuple[str, float, float]:
    """Select pipe size to maintain target velocity.
    Returns: (nominal_size, internal_diameter_inches, actual_velocity_fps)
    """
    sizes = PIPE_SIZES_COPPER  # TODO: add other materials

    for nominal, internal_d in sizes:
        velocity = calculate_velocity(flow_gpm, internal_d)
        if velocity <= velocity_target_fps:
            return nominal, internal_d, velocity

    # Return largest available
    nominal, internal_d = sizes[-1]
    velocity = calculate_velocity(flow_gpm, internal_d)
    return nominal, internal_d, velocity


def calculate_pressure_loss_per_foot(flow_gpm: float, internal_diameter_inches: float,
                                      pipe_material: str = "copper") -> float:
    """Hazen-Williams pressure loss in psi per foot of pipe.
    hf = (4.52 * Q^1.85) / (C^1.85 * d^4.87)
    """
    c = HAZEN_WILLIAMS_C.get(pipe_material, 150.0)
    if internal_diameter_inches <= 0 or c <= 0:
        return 0.0

    numerator = 4.52 * (flow_gpm ** 1.85)
    denominator = (c ** 1.85) * (internal_diameter_inches ** 4.87)
    return numerator / denominator if denominator > 0 else 0.0


def calculate_static_pressure_loss(elevation_ft: float) -> float:
    """Calculate static pressure loss in psi due to elevation.
    P_static = elevation_ft * 0.433 psi/ft
    """
    return elevation_ft * 0.433


def calculate_system_pressure(supply_pressure_psi: float, elevation_ft: float,
                               pipe_length_ft: float, flow_gpm: float,
                               internal_diameter_inches: float,
                               pipe_material: str = "copper",
                               fitting_equivalent_length_ft: float = 0.0) -> dict:
    """Calculate available pressure at most remote fixture.
    Returns dict with all pressure components and adequacy check.
    """
    static_loss = calculate_static_pressure_loss(elevation_ft)
    friction_per_ft = calculate_pressure_loss_per_foot(flow_gpm, internal_diameter_inches, pipe_material)
    total_length = pipe_length_ft + fitting_equivalent_length_ft
    friction_loss = friction_per_ft * total_length

    available = supply_pressure_psi - static_loss - friction_loss
    min_required = 8.0  # Default minimum fixture pressure

    return {
        "supply_pressure_psi": supply_pressure_psi,
        "static_loss_psi": round(static_loss, 2),
        "friction_loss_psi": round(friction_loss, 2),
        "available_pressure_psi": round(available, 2),
        "min_fixture_pressure_psi": min_required,
        "is_adequate": available >= min_required,
    }
