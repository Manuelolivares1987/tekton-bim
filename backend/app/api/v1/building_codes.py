"""Building Codes API - manage construction standards and normativas."""

import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.core.normativas_sudamerica import get_all_countries, get_country_profile
from app.db.session import get_db
from app.services.code_knowledge_service import CodeKnowledgeService

router = APIRouter()


@router.get("/countries")
def list_countries():
    """List all available countries with their profiles."""
    return get_all_countries()


@router.get("/countries/{country}")
def get_country(country: str):
    """Get a specific country profile."""
    profile = get_country_profile(country)
    if not profile:
        raise HTTPException(404, "Country not found")
    return {"code": country, **profile}


@router.get("/codes")
def list_codes(country: str | None = None, db: Session = Depends(get_db)):
    """List all building codes, optionally filtered by country."""
    svc = CodeKnowledgeService(db)
    return svc.list_codes(country)


@router.post("/codes/upload")
async def upload_code(
    file: UploadFile = File(...),
    name: str = Form(...),
    country: str = Form(...),
    code_type: str = Form("general"),
    version: str = Form(""),
    db: Session = Depends(get_db),
):
    """Upload a PDF building code and process it with RAG."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se aceptan archivos PDF")

    # Save file
    upload_dir = os.path.join(settings.upload_dir, "codes")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{country}_{file.filename}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    svc = CodeKnowledgeService(db)
    try:
        result = svc.upload_and_process_pdf(
            file_path=file_path,
            name=name,
            country=country,
            code_type=code_type,
            version=version,
        )
        return result
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(500, f"Error procesando PDF: {str(e)}")


@router.delete("/codes/{code_id}")
def delete_code(code_id: int, db: Session = Depends(get_db)):
    svc = CodeKnowledgeService(db)
    try:
        svc.delete_code(code_id)
        return {"detail": "Deleted"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/search")
def search_codes(country: str, q: str, db: Session = Depends(get_db)):
    """Search building codes by keyword."""
    svc = CodeKnowledgeService(db)
    return svc.search_codes(country, q)


@router.post("/seed")
def seed_builtin(db: Session = Depends(get_db)):
    """Manually trigger seeding of built-in normativas."""
    svc = CodeKnowledgeService(db)
    svc.seed_builtin_codes()
    return {"detail": "Seeded"}
