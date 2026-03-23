"""License API — activate, validate, and manage license keys."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.license_service import (
    load_license,
    remove_license,
    save_license,
    validate_license_key,
)

router = APIRouter()


class ActivateRequest(BaseModel):
    key: str
    email: str = ""


@router.get("/status")
def license_status():
    """Check current license status."""
    return load_license()


@router.post("/activate")
def activate_license(data: ActivateRequest):
    """Activate a license key."""
    result = save_license(data.key, data.email)
    if not result.get("valid"):
        raise HTTPException(400, result.get("message", "Invalid license key"))
    return result


@router.post("/validate")
def validate_key(data: ActivateRequest):
    """Validate a key without saving."""
    return validate_license_key(data.key)


@router.post("/deactivate")
def deactivate_license():
    """Remove stored license."""
    removed = remove_license()
    return {"deactivated": removed}
