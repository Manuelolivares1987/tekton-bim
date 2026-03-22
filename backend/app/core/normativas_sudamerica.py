"""Pre-built building code knowledge for South American countries.

Each country has key construction rules extracted from their national codes.
These are loaded as BuildingCodeChunk records in the database.
"""

COUNTRY_PROFILES = {
    "chile": {
        "name": "Chile",
        "flag": "CL",
        "currency": "CLP",
        "seismic_zones": ["1 (Baja)", "2 (Media)", "3 (Alta)"],
        "default_seismic_zone": 2,
        "codes": ["NCh433", "NCh1928", "NCh853", "OGUC"],
    },
    "argentina": {
        "name": "Argentina",
        "flag": "AR",
        "currency": "ARS",
        "seismic_zones": ["0 (Muy baja)", "1 (Baja)", "2 (Moderada)", "3 (Moderadamente Alta)", "4 (Alta)"],
        "default_seismic_zone": 2,
        "codes": ["CIRSOC 601", "CIRSOC 103", "IRAM 11601"],
    },
    "colombia": {
        "name": "Colombia",
        "flag": "CO",
        "currency": "COP",
        "seismic_zones": ["Baja", "Intermedia", "Alta"],
        "default_seismic_zone": 1,
        "codes": ["NSR-10", "NTC", "RETIE"],
    },
    "peru": {
        "name": "Perú",
        "flag": "PE",
        "currency": "PEN",
        "seismic_zones": ["1", "2", "3", "4"],
        "default_seismic_zone": 3,
        "codes": ["E.030", "E.070", "E.020", "RNE"],
    },
    "brasil": {
        "name": "Brasil",
        "flag": "BR",
        "currency": "BRL",
        "seismic_zones": ["0", "1", "2", "3", "4"],
        "default_seismic_zone": 0,
        "codes": ["NBR 15575", "NBR 6118", "NBR 7190", "NBR 15220"],
    },
    "mexico": {
        "name": "México",
        "flag": "MX",
        "currency": "MXN",
        "seismic_zones": ["A (Baja)", "B (Media)", "C (Alta)", "D (Muy Alta)"],
        "default_seismic_zone": 2,
        "codes": ["NTC-RSEE", "NTC-Madera", "NOM-020-ENER"],
    },
    "ecuador": {
        "name": "Ecuador",
        "flag": "EC",
        "currency": "USD",
        "seismic_zones": ["I (Baja)", "II (Media)", "III (Alta)", "IV (Muy Alta)", "V (Peligro Alto)"],
        "default_seismic_zone": 3,
        "codes": ["NEC-15", "NEC-SE-DS"],
    },
}

# Normativas pre-extraidas por pais y tema
BUILTIN_CODES = [
    # ── CHILE ──
    {
        "country": "chile", "code_name": "NCh433 - Diseño Sísmico", "code_type": "seismic",
        "chunks": [
            {
                "topic": "seismic", "section": "Zonificación Sísmica",
                "content": """Chile se divide en 3 zonas sísmicas según NCh433:
- Zona 1: Aceleración efectiva A0=0.20g (Aysén, Magallanes interior)
- Zona 2: A0=0.30g (zona intermedia, Santiago, Valparaíso)
- Zona 3: A0=0.40g (costa norte, Arica a Concepción costa)
Para construcción en madera/SIP hasta 2 pisos, se aplica diseño simplificado NCh1928.
Requisito de muros de corte: densidad mínima en cada dirección según zona.""",
                "keywords": "sismo,zona,aceleración,NCh433,corte",
            },
            {
                "topic": "structural_walls", "section": "Muros de Corte en Madera",
                "content": """NCh1928 - Requisitos para muros de corte en madera:
- Densidad mínima de muros de corte: 60 cm/m² en zona 3, 45 cm/m² en zona 2, 30 cm/m² en zona 1
- Anclaje al foundation: perno J 12mm cada 1.2m máximo
- Conexión muro-diafragma: clavado continuo
- Arriostramiento: diagonal o revestimiento estructural (OSB 11mm min)
- Largo mínimo muro de corte: 600mm
- Relación alto/largo máxima: 3.5:1
- Holddowns en extremos de muros de corte > 2.4m""",
                "keywords": "muro,corte,arriostramiento,anclaje,holddown,NCh1928",
            },
        ],
    },
    {
        "country": "chile", "code_name": "OGUC - Ordenanza General", "code_type": "dimensions",
        "chunks": [
            {
                "topic": "dimensions", "section": "Dimensiones Mínimas Habitables",
                "content": """OGUC Artículos 4.1 y 4.2 - Dimensiones mínimas:
- Dormitorio principal: 8 m² mínimo
- Dormitorios secundarios: 6 m² mínimo
- Estar/living: 8 m² mínimo (si independiente)
- Cocina: 3.5 m² mínimo
- Baño: 1.5 m² mínimo
- Altura libre mínima: 2.30m recintos habitables, 2.10m baños y cocinas
- Ancho mínimo pasillo: 0.90m
- Ancho mínimo escalera: 0.70m vivienda unifamiliar
- Ventilación natural: 6% de superficie de piso mínimo
- Iluminación natural: 10% de superficie de piso mínimo""",
                "keywords": "dimensión,mínimo,superficie,altura,ventilación,iluminación,OGUC",
            },
            {
                "topic": "openings", "section": "Puertas y Ventanas",
                "content": """OGUC - Requisitos de puertas y ventanas:
- Puerta acceso principal: ancho libre mínimo 0.85m, alto 2.00m
- Puertas interiores: ancho libre mínimo 0.70m
- Puerta baño: ancho libre mínimo 0.60m
- Ventana de escape en dormitorios: 0.60m² mínimo, dimensión mínima 0.50m
- Antepecho máximo ventana escape: 1.20m desde piso
- Vidrio de seguridad bajo 0.50m del piso terminado
- Baranda obligatoria sobre 1.00m de desnivel: altura mínima 0.95m""",
                "keywords": "puerta,ventana,escape,antepecho,baranda,acceso",
            },
        ],
    },
    {
        "country": "chile", "code_name": "NCh853 - Acondicionamiento Térmico", "code_type": "energy",
        "chunks": [
            {
                "topic": "insulation", "section": "Exigencias Térmicas por Zona",
                "content": """NCh853 y Art. 4.1.10 OGUC - Zonas térmicas Chile (7 zonas):
- Zona 1 (Arica-Iquique): Muro U≤4.0, Techo U≤0.84
- Zona 2 (Antofagasta-La Serena): Muro U≤3.0, Techo U≤0.60
- Zona 3 (Valparaíso-Santiago costa): Muro U≤1.9, Techo U≤0.47
- Zona 4 (Santiago-Rancagua): Muro U≤1.7, Techo U≤0.38
- Zona 5 (Talca-Temuco): Muro U≤1.6, Techo U≤0.33
- Zona 6 (Valdivia-Pto Montt): Muro U≤1.1, Techo U≤0.28
- Zona 7 (Aysén-Magallanes): Muro U≤0.6, Techo U≤0.25
Panel SIP EPS114 tiene U≈0.33 W/m²K → cumple zonas 1-5 directamente.""",
                "keywords": "térmico,aislación,zona,transmitancia,EPS,SIP,NCh853",
            },
        ],
    },

    # ── ARGENTINA ──
    {
        "country": "argentina", "code_name": "CIRSOC 601 - Madera", "code_type": "structural",
        "chunks": [
            {
                "topic": "structural_walls", "section": "Entramado de Madera",
                "content": """CIRSOC 601 - Estructuras de madera:
- Montantes (studs): escuadría mínima 2"x4" (50x100mm cepillado: 45x95mm)
- Separación máxima montantes: 60cm (recomendado 40cm en zona sísmica)
- Solera inferior: misma escuadría que montantes
- Solera superior: doble en muros portantes
- Diagonal de arriostramiento: 1"x4" mínimo o placa OSB 9.5mm
- Clavado: clavos 3" (75mm) cada 15cm en bordes, 30cm en campo
- Madera: pino elliottii, eucalyptus grandis, o equivalente grado C
- Humedad máxima 19% al momento de instalación""",
                "keywords": "montante,stud,solera,clavado,madera,CIRSOC,entramado",
            },
            {
                "topic": "seismic", "section": "Diseño Sismorresistente",
                "content": """CIRSOC 103 - Zonificación sísmica Argentina:
- Zona 0: sin riesgo sísmico (Pampa, Patagonia este)
- Zona 1: riesgo reducido
- Zona 2: riesgo moderado (Córdoba, Buenos Aires)
- Zona 3: riesgo elevado (Mendoza, San Juan, Salta)
- Zona 4: riesgo muy elevado (San Juan centro)
Para viviendas de madera ≤2 pisos en zona ≤2: diseño simplificado permitido.
Zona 3-4: requiere cálculo estructural por ingeniero.""",
                "keywords": "sismo,zona,CIRSOC,Argentina,riesgo",
            },
        ],
    },

    # ── COLOMBIA ──
    {
        "country": "colombia", "code_name": "NSR-10 - Sismo Resistencia", "code_type": "seismic",
        "chunks": [
            {
                "topic": "seismic", "section": "Zonificación y Requisitos",
                "content": """NSR-10 Título A - Requisitos sismorresistentes:
- Zona de amenaza baja: Aa < 0.10 (Llanos, Amazonas)
- Zona de amenaza intermedia: 0.10 ≤ Aa < 0.20 (Bogotá, Medellín periferia)
- Zona de amenaza alta: Aa ≥ 0.20 (Eje cafetero, costa Pacífico, Nariño)
- Coeficiente de importancia grupo I (vivienda): 1.0
NSR-10 Título G - Madera:
- Permite construcción en madera hasta 2 pisos en todas las zonas
- Muros de corte en madera: OSB 11mm o contrachapado 12mm como diafragma
- Anclaje a cimentación obligatorio con varilla roscada 12mm""",
                "keywords": "NSR-10,sismo,Colombia,madera,amenaza,muro corte",
            },
            {
                "topic": "dimensions", "section": "Dimensiones Mínimas Vivienda",
                "content": """NSR-10 y NTC 4595 - Dimensiones mínimas:
- Alcoba principal: 7.5 m² (dimensión mínima 2.50m)
- Alcobas adicionales: 5.1 m² (dimensión mínima 2.10m)
- Sala-comedor: 10.8 m² (combinado)
- Cocina: 3.6 m² (dimensión mínima 1.50m)
- Baño: 2.3 m² (dimensión mínima 1.10m)
- Altura libre mínima: 2.20m
- Ancho mínimo circulación: 0.80m""",
                "keywords": "dimensión,mínimo,alcoba,vivienda,Colombia,NTC",
            },
        ],
    },

    # ── PERÚ ──
    {
        "country": "peru", "code_name": "E.030 - Diseño Sismorresistente", "code_type": "seismic",
        "chunks": [
            {
                "topic": "seismic", "section": "Zonificación Sísmica Perú",
                "content": """Norma E.030 RNE - Zonificación sísmica:
- Zona 1: Z=0.10 (Selva baja, Loreto)
- Zona 2: Z=0.25 (Selva alta, parte sierra)
- Zona 3: Z=0.35 (Sierra central, Cusco, Arequipa)
- Zona 4: Z=0.45 (Costa, Lima, Trujillo, todo litoral)
Para vivienda de madera ≤2 pisos: sistema estructural de muros portantes.
Restricción: en zona 4, requiere diseño sismo-resistente formal.
Norma E.010 Madera: permite entramado ligero con madera certificada.""",
                "keywords": "E.030,sismo,Perú,zona,madera,litoral",
            },
        ],
    },

    # ── BRASIL ──
    {
        "country": "brasil", "code_name": "NBR 15575 - Desempenho", "code_type": "structural",
        "chunks": [
            {
                "topic": "structural_walls", "section": "Requisitos Estructurales",
                "content": """NBR 15575 - Norma de Desempenho Habitacional:
- Paredes externas: resistência mínima a impacto de corpo mole
- Nível mínimo de desempenho: M (mínimo), I (intermediário), S (superior)
- Wood frame (entramado): regulado por Diretriz SINAT 005
- Montantes: mínimo 38x89mm (2x4"), espaçamento máximo 60cm
- Revestimento estrutural: OSB 11.1mm ou compensado 12mm
- Barreira contra umidade obrigatória na base
- Tratamento preservativo CCA ou equivalente obrigatório
NBR 7190 Madeira: classes de resistência C20, C25, C30.""",
                "keywords": "NBR,15575,desempenho,wood frame,montante,Brasil",
            },
            {
                "topic": "insulation", "section": "Desempenho Térmico",
                "content": """NBR 15220 e NBR 15575-4 - Zonas bioclimáticas Brasil:
- Zona 1 (Sul frio): transmitância parede U≤2.5, cobertura U≤2.0
- Zona 2 (Sul temperado): U≤2.5, U≤2.0
- Zona 3 (Sudeste): U≤3.7, U≤2.0
- Zona 4-5 (Centro-oeste): U≤3.7, U≤2.0
- Zona 6-7 (Nordeste): U≤3.7, U≤2.0 + absortância ≤0.6
- Zona 8 (Norte equatorial): ventilação cruzada obrigatória
Panel SIP EPS114 (U≈0.33): supera todas as zonas brasileiras.""",
                "keywords": "térmico,NBR,15220,zona,bioclimática,isolamento,Brasil",
            },
        ],
    },

    # ── MÉXICO ──
    {
        "country": "mexico", "code_name": "NTC-RSEE Sismo", "code_type": "seismic",
        "chunks": [
            {
                "topic": "seismic", "section": "Zonificación Sísmica México",
                "content": """Normas Técnicas Complementarias para Diseño por Sismo:
- Zona A: baja sismicidad (Yucatán, parte norte)
- Zona B: media (centro-norte, Monterrey)
- Zona C: alta (costa Pacífico, Oaxaca, Guerrero)
- Zona D: muy alta (Guerrero costa, Michoacán, CDMX zona lago)
Para vivienda madera ≤2 niveles zona A-B: diseño simplificado.
Zona C-D: requiere diseño por especialista.
NTC-Madera: permite entramado ligero con pino mexicano tratado.""",
                "keywords": "NTC,sismo,México,zona,madera,Pacífico",
            },
        ],
    },

    # ── ECUADOR ──
    {
        "country": "ecuador", "code_name": "NEC-15 Construcción", "code_type": "seismic",
        "chunks": [
            {
                "topic": "seismic", "section": "Peligro Sísmico Ecuador",
                "content": """NEC-SE-DS - Peligro sísmico Ecuador:
- Zona I: Z=0.15 (Oriente bajo)
- Zona II: Z=0.25 (Sierra centro)
- Zona III: Z=0.30 (Sierra sur, costa norte)
- Zona IV: Z=0.35 (Costa central, Guayaquil)
- Zona V: Z=0.40-0.50 (Costa norte, Esmeraldas, frontera Perú)
Ecuador es altamente sísmico. Construcción en madera regulada por NEC-SE-MD.
Requiere diseño sismorresistente en todas las zonas.
Madera permitida: teca, chanul, eucalipto, pino radiata importado.""",
                "keywords": "NEC,sismo,Ecuador,zona,madera,peligro",
            },
        ],
    },
]


def get_country_profile(country: str) -> dict | None:
    """Get country profile for onboarding."""
    return COUNTRY_PROFILES.get(country)


def get_all_countries() -> list[dict]:
    """Get all available countries for the selector."""
    return [
        {"code": k, **v}
        for k, v in COUNTRY_PROFILES.items()
    ]
