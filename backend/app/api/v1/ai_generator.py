"""AI House Generator API - generate complete houses from natural language."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ai_house_generator_service import (
    AiHouseGeneratorService,
    HouseSpec,
)

router = APIRouter()


class GenerateRequest(BaseModel):
    prompt: str
    project_id: int | None = None
    project_name: str = "Casa IA"
    seismic_zone: int = 2
    country: str = "chile"
    floors: int = 1


class PreviewResponse(BaseModel):
    spec: dict
    wall_count: int
    opening_count: int
    estimated_area_m2: float


@router.post("/generate-preview")
def generate_preview(data: GenerateRequest, db: Session = Depends(get_db)):
    """Generate a house spec preview WITHOUT creating anything in DB."""
    svc = AiHouseGeneratorService(db)
    try:
        spec = svc.generate_preview(
            prompt=data.prompt,
            seismic_zone=data.seismic_zone,
            country=data.country,
            floors=data.floors,
        )
        opening_count = sum(len(w.openings) for w in spec.walls)
        return {
            "spec": spec.model_dump(),
            "wall_count": len(spec.walls),
            "opening_count": opening_count,
            "estimated_area_m2": spec.total_area_m2,
        }
    except Exception as e:
        raise HTTPException(500, f"Error generating house: {str(e)}")


@router.post("/commit")
def commit_house(data: GenerateRequest, db: Session = Depends(get_db)):
    """Generate AND create the complete BIM model."""
    from app.models.project import Project

    # Create or use project
    if data.project_id:
        project = db.query(Project).filter(Project.id == data.project_id).first()
        if not project:
            raise HTTPException(404, "Project not found")
        project_id = project.id
    else:
        project = Project(name=data.project_name, description=f"Generado por IA: {data.prompt[:200]}")
        db.add(project)
        db.commit()
        db.refresh(project)
        project_id = project.id

    svc = AiHouseGeneratorService(db)
    try:
        result = svc.generate_and_commit(
            project_id=project_id,
            prompt=data.prompt,
            seismic_zone=data.seismic_zone,
            country=data.country,
            floors=data.floors,
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"Error generating house: {str(e)}")


@router.post("/commit-spec")
def commit_spec(project_id: int, spec: HouseSpec, db: Session = Depends(get_db)):
    """Create a BIM model from an existing HouseSpec (from preview)."""
    svc = AiHouseGeneratorService(db)
    try:
        return svc.commit_house(project_id, spec)
    except Exception as e:
        raise HTTPException(500, f"Error committing house: {str(e)}")
