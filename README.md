# Tekton BIM

Software de construcción modular con paneles SIP — diseño, panelización, entramado, cubicación y generación IA.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.13 · FastAPI · SQLAlchemy · SQLite |
| Frontend | React 19 · TypeScript · Three.js · Zustand · TailwindCSS |
| Desktop | Electron 34 |
| IA | Anthropic Claude (Sonnet 4.5) |
| Build | Vite 6 |

## Setup local

### Requisitos
- Python 3.11+
- Node.js 20+
- npm 10+

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # editar ANTHROPIC_API_KEY
python -m uvicorn app.main:app --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Tests
```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npx vitest run
```

## Arquitectura

```
backend/
  app/
    api/v1/          → 16 routers REST
    services/        → lógica de negocio (24 servicios)
    models/          → 27 modelos SQLAlchemy
    core/            → reglas construcción, normativas, constantes
    db/              → sesión, seeds, migraciones

frontend/
  src/
    components/
      bim-modeler/   → modelador 3D + planta 2D
        geometry.ts      matemática pura
        SceneSetup.ts    inicialización Three.js
        WallRenderer.ts  rendering de paneles/framing
        FloorPlanView.tsx canvas 2D
        BimModeler3D.tsx  orquestador principal
        OpeningDialog.tsx aberturas
        WallPropertiesPanel.tsx propiedades
      ai/            → generador IA
      layout/        → sidebar, topbar, dashboard
      panelization/  → motor SIP
      ui/            → error boundary
    store/
      wall-store.ts    dominio (muros, paneles, assemblies)
      tool-store.ts    UI (herramienta activa, selección)
      history-store.ts undo/redo command pattern
    api/             → clientes HTTP (Axios)
  electron/          → main process, preload, backend-manager
```

## Paradigma

**Wall-first**: el usuario dibuja muros (P1→P2), el sistema auto-genera:
- Paneles SIP (1220mm estándar)
- Soleras continuas (inferior + superior doble)
- Pie derechos en extremos
- Tablillas OSB / pie derecho en juntas (configurable)
- Entramado de vanos (king studs, jack studs, dintel, alféizar)

## Convenciones

- **Coordenadas**: mm en backend, metros en Three.js (SCALE = 0.001)
- **Rotación**: backend usa `atan2(dz, dx)` en grados, Three.js usa `-deg2rad(rotation_deg)` via `backendRotToThreeY()`
- **Stores**: dominio en `wall-store`, UI en `tool-store`, undo en `history-store`
- **Undo/Redo**: command pattern — cada acción tiene `execute()` y `undo()`

## Países soportados

Chile · Argentina · Colombia · Perú · Brasil · México · Ecuador

Cada país tiene normativas pre-cargadas (NCh433, CIRSOC, NSR-10, E.030, NBR 15575, NTC, NEC-15).
