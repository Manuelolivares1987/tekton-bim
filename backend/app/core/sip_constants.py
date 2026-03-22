"""Constants for SIP panel panelization."""

# Standard SIP core thicknesses (mm)
SIP_CORE_THICKNESSES = [64, 89, 114, 140, 165, 210]

# Standard SIP skin thicknesses (mm)
SIP_SKIN_THICKNESSES = [11.0, 15.0]

# Standard panel widths (mm)
STANDARD_PANEL_WIDTHS = [610, 1220]

# Standard panel heights (mm)
STANDARD_PANEL_HEIGHTS = [2440, 2745, 3050, 3660]

# Joint types
JOINT_TYPES = ["spline", "cam_lock", "surface_spline"]

# Rough opening clearances (mm added to each side)
ROUGH_OPENING_CLEARANCE = {
    "door": {"width": 25, "height": 15},    # 25mm each side width, 15mm top
    "window": {"width": 20, "height": 20},  # 20mm each side
}

# Minimum panel width before merging with adjacent panel (mm)
MIN_PANEL_WIDTH = 200

# Fastener rules for cubication
SIP_FASTENER_RULES = {
    "screws_per_mm_perimeter": 1 / 300,  # 1 screw every 300mm along perimeter
    "screws_per_mm_attachment": 1 / 150,  # 1 screw every 150mm along attachment lines
    "adhesive_kg_per_m2": 0.3,           # kg of adhesive per m2 of panel
    "spline_per_joint": 1,               # 1 spline piece per panel-to-panel joint
}

# Panel type prefixes for labeling
PANEL_TYPE_PREFIX = {
    "sip": "SIP",
    "wood_frame": "WF",
}
