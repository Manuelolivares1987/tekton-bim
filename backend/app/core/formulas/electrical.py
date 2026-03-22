"""Electrical engineering calculation formulas (NEC-based)."""

import math

# NEC Table 310.16 - Allowable ampacities for copper conductors at 75C
# Format: AWG/kcmil -> ampacity
WIRE_AMPACITY: dict[str, float] = {
    "14": 15.0,
    "12": 20.0,
    "10": 30.0,
    "8": 40.0,
    "6": 55.0,
    "4": 70.0,
    "3": 85.0,
    "2": 95.0,
    "1": 110.0,
    "1/0": 125.0,
    "2/0": 145.0,
    "3/0": 165.0,
    "4/0": 195.0,
    "250": 215.0,
    "300": 240.0,
    "350": 260.0,
    "400": 280.0,
    "500": 320.0,
}

# Wire resistance in ohms per 1000 feet (copper, DC at 75C) - NEC Chapter 9 Table 8
WIRE_RESISTANCE: dict[str, float] = {
    "14": 3.14,
    "12": 1.98,
    "10": 1.24,
    "8": 0.778,
    "6": 0.491,
    "4": 0.308,
    "3": 0.245,
    "2": 0.194,
    "1": 0.154,
    "1/0": 0.122,
    "2/0": 0.0967,
    "3/0": 0.0766,
    "4/0": 0.0608,
    "250": 0.0515,
    "300": 0.0429,
    "350": 0.0367,
    "400": 0.0321,
    "500": 0.0258,
}

# Wire cross-sectional area in sq inches (for conduit fill) - NEC Chapter 9 Table 5
WIRE_AREA_SQIN: dict[str, float] = {
    "14": 0.0097,
    "12": 0.0133,
    "10": 0.0211,
    "8": 0.0366,
    "6": 0.0507,
    "4": 0.0824,
    "3": 0.0973,
    "2": 0.1158,
    "1": 0.1562,
    "1/0": 0.1855,
    "2/0": 0.2223,
    "3/0": 0.2679,
    "4/0": 0.3237,
}

# Conduit internal area in sq inches (EMT)
CONDUIT_AREA_SQIN: dict[str, float] = {
    "1/2": 0.304,
    "3/4": 0.533,
    "1": 0.864,
    "1-1/4": 1.496,
    "1-1/2": 1.946,
    "2": 3.356,
    "2-1/2": 5.858,
    "3": 8.846,
    "3-1/2": 11.545,
    "4": 14.753,
}

# Standard breaker sizes in amps
STANDARD_BREAKERS: list[float] = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200]

# NEC 220.12 General lighting loads (VA per sq ft)
LIGHTING_LOADS: dict[str, float] = {
    "dwelling": 3.0,
    "office": 3.5,
    "retail": 1.5,
    "warehouse": 0.25,
    "hospital": 2.0,
    "hotel": 2.0,
    "school": 3.0,
}


def calculate_current(watts: float, voltage: float, phase: str = "single",
                      power_factor: float = 1.0) -> float:
    """Calculate current in amps. NEC standard formula."""
    if voltage <= 0 or power_factor <= 0:
        return 0.0
    if phase == "three":
        return watts / (voltage * power_factor * math.sqrt(3))
    return watts / (voltage * power_factor)


def apply_continuous_factor(amps: float, is_continuous: bool = False) -> float:
    """Apply 125% continuous load factor per NEC 210.20(A)."""
    if is_continuous:
        return amps * 1.25
    return amps


def select_breaker(amps: float) -> float:
    """Select the next standard breaker size >= amps."""
    for breaker in STANDARD_BREAKERS:
        if breaker >= amps:
            return breaker
    return STANDARD_BREAKERS[-1]


def select_wire_size(amps: float) -> str:
    """Select minimum wire gauge with ampacity >= amps."""
    wire_order = ["14", "12", "10", "8", "6", "4", "3", "2", "1",
                  "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500"]
    for wire in wire_order:
        if WIRE_AMPACITY[wire] >= amps:
            return wire
    return "500"


def calculate_voltage_drop(wire_size: str, length_m: float, current_amps: float,
                           voltage: float, phase: str = "single") -> tuple[float, float]:
    """Calculate voltage drop in volts and percentage.
    Returns: (voltage_drop_volts, voltage_drop_pct)
    """
    length_ft = length_m * 3.28084
    resistance = WIRE_RESISTANCE.get(wire_size, 1.0)

    if phase == "three":
        vd = (math.sqrt(3) * resistance * current_amps * length_ft) / 1000.0
    else:
        vd = (2.0 * resistance * current_amps * length_ft) / 1000.0

    vd_pct = (vd / voltage) * 100.0 if voltage > 0 else 0.0
    return vd, vd_pct


def size_wire_with_voltage_drop(load_amps: float, length_m: float, voltage: float,
                                 max_drop_pct: float = 3.0,
                                 phase: str = "single") -> tuple[str, float, float]:
    """Select wire size considering both ampacity and voltage drop.
    Returns: (wire_size, ampacity, voltage_drop_pct)
    """
    wire_order = ["14", "12", "10", "8", "6", "4", "3", "2", "1",
                  "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500"]

    for wire in wire_order:
        if WIRE_AMPACITY[wire] < load_amps:
            continue
        _, vd_pct = calculate_voltage_drop(wire, length_m, load_amps, voltage, phase)
        if vd_pct <= max_drop_pct:
            return wire, WIRE_AMPACITY[wire], vd_pct

    return "500", WIRE_AMPACITY["500"], 0.0


def select_conduit(wire_count: int, wire_size: str) -> str:
    """Select conduit size based on NEC fill rules.
    1 wire: 53%, 2 wires: 31%, 3+ wires: 40% fill.
    """
    wire_area = WIRE_AREA_SQIN.get(wire_size, 0.1)
    total_wire_area = wire_area * wire_count

    if wire_count == 1:
        fill_pct = 0.53
    elif wire_count == 2:
        fill_pct = 0.31
    else:
        fill_pct = 0.40

    required_area = total_wire_area / fill_pct

    conduit_order = ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4"]
    for conduit in conduit_order:
        if CONDUIT_AREA_SQIN[conduit] >= required_area:
            return conduit

    return "4"


def calculate_lighting_load(floor_area_m2: float, building_type: str = "dwelling") -> float:
    """Calculate general lighting load in VA per NEC 220.12."""
    floor_area_sqft = floor_area_m2 * 10.764
    va_per_sqft = LIGHTING_LOADS.get(building_type, 3.0)
    return floor_area_sqft * va_per_sqft
