"""Insulation (volcanic rock / lana de roca) calculation formulas."""


def calculate_insulation_volume(area_m2: float, thickness_mm: float) -> float:
    """Calculate insulation volume in m3 from area and thickness."""
    return area_m2 * (thickness_mm / 1000.0)


def calculate_insulation_weight(volume_m3: float, density_kg_m3: float) -> float:
    """Calculate insulation weight in kg from volume and density."""
    return volume_m3 * density_kg_m3


def apply_waste_factor(weight_kg: float, waste_factor_pct: float) -> float:
    """Apply waste factor percentage to weight. waste_factor_pct is e.g. 5.0 for 5%."""
    return weight_kg * (1.0 + waste_factor_pct / 100.0)


def calculate_r_value(thickness_mm: float, thermal_conductivity_w_mk: float) -> float:
    """Calculate thermal resistance R-value in m2*K/W.
    R = thickness(m) / thermal_conductivity(W/m*K)
    """
    if thermal_conductivity_w_mk <= 0:
        return 0.0
    return (thickness_mm / 1000.0) / thermal_conductivity_w_mk
