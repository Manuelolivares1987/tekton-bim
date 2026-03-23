"""Compliance API — normative validation semaphore."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.compliance_checker import check_project_compliance

router = APIRouter()


@router.get("/project/{project_id}/check")
def check_compliance(project_id: int, country: str = "chile", db: Session = Depends(get_db)):
    """Run all compliance checks and return semáforo normativo."""
    return check_project_compliance(db, project_id, country)
