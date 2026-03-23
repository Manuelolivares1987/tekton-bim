"""IFC file management API endpoints."""

import os
import shutil
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.ifc_model import IfcModel
from app.schemas.ifc import IfcElementResponse, IfcModelResponse, IfcModelSummary, IfcUploadResponse
from app.services.ifc_parser import IfcParsingService

router = APIRouter()


@router.post("/upload", response_model=IfcUploadResponse)
def upload_ifc(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and parse an IFC file."""
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(status_code=400, detail="File must be an IFC file (.ifc)")

    # Save uploaded file
    os.makedirs(settings.upload_dir, exist_ok=True)
    unique_name = f"{uuid4().hex}_{file.filename}"
    file_path = os.path.join(settings.upload_dir, unique_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)

    # Parse the file
    try:
        service = IfcParsingService(db)
        result = service.import_and_parse(
            project_id=project_id,
            file_name=file.filename,
            file_path=file_path,
            file_size=file_size,
        )
        return result
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to parse IFC file: {str(e)}")


@router.get("/models", response_model=list[IfcModelResponse])
def list_models(
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List all imported IFC models."""
    query = db.query(IfcModel)
    if project_id:
        query = query.filter(IfcModel.project_id == project_id)
    return query.order_by(IfcModel.created_at.desc()).all()


@router.get("/models/{model_id}", response_model=IfcModelResponse)
def get_model(model_id: int, db: Session = Depends(get_db)):
    """Get IFC model metadata."""
    model = db.query(IfcModel).filter(IfcModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.delete("/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    """Delete an IFC model and its elements."""
    model = db.query(IfcModel).filter(IfcModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Delete file
    if os.path.exists(model.file_path):
        os.remove(model.file_path)

    db.delete(model)
    db.commit()
    return {"status": "deleted"}


@router.get("/models/{model_id}/summary", response_model=IfcModelSummary)
def get_model_summary(model_id: int, db: Session = Depends(get_db)):
    """Get model summary with element counts by type."""
    service = IfcParsingService(db)
    summary = service.get_model_summary(model_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Model not found")
    return summary


@router.get("/models/{model_id}/elements", response_model=list[IfcElementResponse])
def list_elements(
    model_id: int,
    ifc_type: str | None = None,
    storey: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """List elements with optional filtering and pagination."""
    service = IfcParsingService(db)
    elements, total = service.get_elements(model_id, ifc_type, storey, page, limit)
    return elements


@router.get("/models/{model_id}/file")
def download_ifc_file(model_id: int, db: Session = Depends(get_db)):
    """Download the original IFC file (for 3D viewer)."""
    model = db.query(IfcModel).filter(IfcModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if not os.path.exists(model.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        model.file_path,
        filename=model.file_name,
        media_type="application/octet-stream",
    )
