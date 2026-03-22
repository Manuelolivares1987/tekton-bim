"""Default building rules and standards for AI house generation.

These rules are embedded in Claude's system prompt to ensure
generated houses comply with construction standards.
"""

# Chilean NCh433 seismic + NCh1928 + OGUC
CHILEAN_RULES = """
## Normativa Chilena (NCh433, NCh1928, OGUC)
- Zonas sísmicas: 1 (baja), 2 (media), 3 (alta)
- Altura máxima muros SIP: 2440mm (1 piso), 2740mm máx
- Espesor mínimo muro exterior: 136mm (SIP EPS114 + 2x OSB 11mm)
- Espesor mínimo muro interior: 89mm (entramado 2x4)
- Arriostramiento sísmico: muros de corte cada 6m máx en zona 3
- Distancia máxima sin arriostramiento: 8m zona 1, 6m zona 2-3
- Ancho mínimo pasillo: 900mm (OGUC Art 4.2.7)
- Ancho mínimo puerta: 800mm interior, 900mm acceso
- Altura mínima cielo: 2300mm habitable, 2100mm baño/cocina
- Ventilación: ventanas ≥ 8% superficie piso del recinto
- Iluminación: ventanas ≥ 10% superficie piso del recinto
- Salida de emergencia: distancia máxima 20m a puerta exterior
"""

# IRC (International Residential Code) - US/International
IRC_RULES = """
## IRC (International Residential Code)
- Stud spacing: 16" OC (406mm) or 24" OC (610mm)
- Wall height: 8' (2440mm) standard, 9' (2740mm), 10' (3050mm)
- Min room size: 70 sq ft (6.5m²) with min dimension 7' (2134mm)
- Min ceiling height: 7' (2134mm) habitable rooms
- Hallway min width: 36" (914mm)
- Door min width: 32" (813mm) egress, 28" (711mm) interior
- Window: min 8% floor area for light, 4% for ventilation
- Egress window: min 5.7 sq ft (0.53m²), min 24" height, 20" width
- Header sizing: up to 4'=2x6, 6'=2x8, 8'=2x10, 10'=2x12
- Max opening without engineered header: 10' (3050mm)
"""

# SIP panel construction specifics
SIP_CONSTRUCTION_RULES = """
## Reglas de Construcción SIP
- Panel estándar: 1220mm x 2440mm (4'x8')
- Paneles disponibles: 610mm, 1220mm anchos
- Alturas: 2440mm, 2740mm, 3050mm, 3660mm
- Espesor EPS: 64, 89, 114, 140, 165, 210mm
- Piel OSB: 11mm o 15mm por lado
- Unión entre paneles: pie derecho 2x4 (38x89mm)
- Solera inferior: 1x 2x4
- Solera superior: 2x 2x4 (doble placa)
- Rough opening puerta: ancho + 50mm, alto + 15mm
- Rough opening ventana: ancho + 40mm, alto + 40mm
- Peso panel 1220x2440 EPS114: ~49 kg
- R-value EPS 114mm: ~3.0 m²K/W
"""

# Coordinate system and dimensional constraints for AI
GEOMETRY_RULES = """
## Sistema de Coordenadas y Restricciones
- Eje X: Este-Oeste (positivo = Este)
- Eje Z: Norte-Sur (positivo = Sur)
- Eje Y: Vertical (positivo = arriba)
- Todos los muros se definen como (start_x, start_z) → (end_x, end_z)
- Los muros deben ser rectos (no curvos)
- Unidad: milímetros (mm)
- Coordenadas típicas: origen (0,0) en esquina nor-oeste
- Ancho mínimo de muro: 400mm
- Largo máximo de muro sin arriostramiento: 8000mm
- Los muros deben formar recintos cerrados (unir esquinas)
- Snap a grilla de 100mm para coordinación dimensional
"""

# Room sizing guidelines
ROOM_SIZING = """
## Dimensiones Estándar de Recintos (Chile/Latinoamérica)
- Dormitorio principal: 12-16 m² (ej: 4000x3500mm)
- Dormitorio secundario: 9-12 m² (ej: 3000x3500mm)
- Sala de estar/living: 15-25 m² (ej: 5000x4000mm)
- Cocina: 8-12 m² (ej: 3500x3000mm)
- Cocina americana (integrada): parte del living
- Baño completo: 4-6 m² (ej: 2500x2000mm)
- Baño de visita: 2-3 m² (ej: 1500x1800mm)
- Comedor: 10-14 m² (ej: 3500x3500mm)
- Pasillo: ancho mínimo 900mm, ideal 1000mm
- Lavandería/loggia: 3-5 m² (ej: 2000x2000mm)
"""

# Default material prices (CLP - Chilean Pesos, approximate 2024)
DEFAULT_PRICES_CLP = {
    "sip_panel_1220x2440_eps114": {"unit": "un", "price": 85000, "desc": "Panel SIP 1220x2440 EPS114"},
    "sip_panel_610x2440_eps114": {"unit": "un", "price": 48000, "desc": "Panel SIP 610x2440 EPS114"},
    "sip_panel_custom_m2": {"unit": "m²", "price": 32000, "desc": "Panel SIP custom por m²"},
    "lumber_2x4_3m": {"unit": "un", "price": 3500, "desc": "Pino 2x4 3m (38x89mm)"},
    "lumber_2x6_3m": {"unit": "un", "price": 5200, "desc": "Pino 2x6 3m (38x140mm)"},
    "lumber_2x8_3m": {"unit": "un", "price": 7800, "desc": "Pino 2x8 3m (38x184mm)"},
    "osb_11mm_1220x2440": {"unit": "un", "price": 12500, "desc": "OSB 11mm 1220x2440"},
    "screw_75mm_kg": {"unit": "kg", "price": 4500, "desc": "Tornillo 75mm (por kg)"},
    "adhesive_sip_kg": {"unit": "kg", "price": 8000, "desc": "Adhesivo SIP poliuretano"},
    "tape_sip_roll": {"unit": "un", "price": 15000, "desc": "Cinta selladora SIP 60m"},
    "foundation_radier_m2": {"unit": "m²", "price": 45000, "desc": "Radier H20 e=10cm"},
    "roof_shingle_m2": {"unit": "m²", "price": 12000, "desc": "Teja asfáltica"},
    "window_standard_1200x1200": {"unit": "un", "price": 95000, "desc": "Ventana aluminio 1200x1200 DVH"},
    "window_large_1800x1200": {"unit": "un", "price": 145000, "desc": "Ventana aluminio 1800x1200 DVH"},
    "door_interior_800x2000": {"unit": "un", "price": 55000, "desc": "Puerta interior 800x2000"},
    "door_exterior_900x2100": {"unit": "un", "price": 120000, "desc": "Puerta exterior 900x2100"},
    "electrical_point": {"unit": "un", "price": 25000, "desc": "Punto eléctrico (enchufe/interruptor)"},
    "plumbing_point": {"unit": "un", "price": 35000, "desc": "Punto sanitario"},
    "labor_construction_m2": {"unit": "m²", "price": 180000, "desc": "Mano de obra construcción SIP/m²"},
    "transport_flat": {"unit": "gl", "price": 350000, "desc": "Transporte materiales (global)"},
}


def get_full_rules_context(seismic_zone: int = 2, country: str = "chile") -> str:
    """Build the complete rules context for Claude's system prompt."""
    rules = [SIP_CONSTRUCTION_RULES, GEOMETRY_RULES, ROOM_SIZING]

    if country == "chile":
        rules.insert(0, CHILEAN_RULES)
    else:
        rules.insert(0, IRC_RULES)

    return "\n".join(rules)
