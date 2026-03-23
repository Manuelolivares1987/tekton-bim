"""Assembly plan API endpoints - schedule, BOM, summary, PDF export."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import Project
from app.schemas.assembly_plan import (
    AssemblySummaryResponse,
    MaterialBOMResponse,
    PanelScheduleResponse,
)
from app.services.assembly_plan_service import AssemblyPlanService
from app.services.pdf_generator import PdfGenerator

router = APIRouter()


@router.get("/{project_id}/schedule", response_model=PanelScheduleResponse)
def get_panel_schedule(project_id: int, db: Session = Depends(get_db)):
    service = AssemblyPlanService(db)
    return service.generate_panel_schedule(project_id)


@router.get("/{project_id}/bom", response_model=MaterialBOMResponse)
def get_material_bom(
    project_id: int,
    waste_factor: float = Query(default=1.1, ge=1.0, le=2.0),
    db: Session = Depends(get_db),
):
    service = AssemblyPlanService(db)
    return service.generate_material_bom(project_id, waste_factor)


@router.get("/{project_id}/summary", response_model=AssemblySummaryResponse)
def get_assembly_summary(project_id: int, db: Session = Depends(get_db)):
    service = AssemblyPlanService(db)
    return service.generate_assembly_summary(project_id)


@router.get("/{project_id}/pdf")
def export_assembly_pdf(
    project_id: int,
    waste_factor: float = Query(default=1.1, ge=1.0, le=2.0),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    project_name = project.name if project else f"Project {project_id}"

    service = AssemblyPlanService(db)
    schedule = service.generate_panel_schedule(project_id)
    bom = service.generate_material_bom(project_id, waste_factor)
    summary = service.generate_assembly_summary(project_id)

    pdf_gen = PdfGenerator()
    pdf_bytes = pdf_gen.generate_assembly_pdf(project_name, schedule, bom, summary)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="assembly-plan-{project_id}.pdf"',
        },
    )
