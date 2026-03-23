from fastapi import APIRouter  # lumber-takeoff route added

from app.api.v1 import (
    ai_generator,
    assembly_plans,
    bim_modeler,
    board_coverage,
    building_codes,
    calculations,
    export,
    floor_plan,
    ifc,
    license,
    lumber_takeoff,
    materials,
    mep_electrical,
    mep_plumbing,
    panel_assignments,
    panelization,
    panels,
    projects,
)

api_router = APIRouter()

api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(ifc.router, prefix="/ifc", tags=["ifc"])
api_router.include_router(panels.router, prefix="/panels", tags=["panels"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(calculations.router, prefix="/calculations", tags=["calculations"])
api_router.include_router(mep_electrical.router, prefix="/calculations/electrical", tags=["electrical"])
api_router.include_router(mep_plumbing.router, prefix="/calculations/plumbing", tags=["plumbing"])
api_router.include_router(panel_assignments.router, prefix="/panel-assignments", tags=["panel-assignments"])
api_router.include_router(assembly_plans.router, prefix="/assembly-plans", tags=["assembly-plans"])
api_router.include_router(lumber_takeoff.router, prefix="/lumber-takeoff", tags=["lumber-takeoff"])
api_router.include_router(board_coverage.router, prefix="/board-coverage", tags=["board-coverage"])
api_router.include_router(panelization.router, prefix="/panelization", tags=["panelization"])
api_router.include_router(floor_plan.router, prefix="/floor-plans", tags=["floor-plans"])
api_router.include_router(bim_modeler.router, prefix="/bim-modeler", tags=["bim-modeler"])
api_router.include_router(ai_generator.router, prefix="/ai", tags=["ai-generator"])
api_router.include_router(building_codes.router, prefix="/codes", tags=["building-codes"])
api_router.include_router(license.router, prefix="/license", tags=["license"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
