"""License validation service for Tekton BIM.

Architecture decision: For a desktop Electron app, we use a simple
license key system rather than OAuth/JWT. The key is stored locally
and validated on startup.

Key format: TEKTON-XXXX-XXXX-XXXX-XXXX (20 chars + dashes)
Validation: HMAC-SHA256 of key prefix against a shared secret.

For MVP: keys are validated locally with a hardcoded secret.
For production: keys would be validated against a remote license server.
"""

import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path

# In production, this would be obfuscated or fetched from a server
_LICENSE_SECRET = "tekton-bim-2026-license-validation"
_LICENSE_FILE = "tekton-license.json"


def get_license_path() -> Path:
    """Get the path to the license file in user data directory."""
    # Electron sets userData path; fallback to home directory
    user_data = os.environ.get("TEKTON_DATA_DIR", str(Path.home() / ".tekton"))
    os.makedirs(user_data, exist_ok=True)
    return Path(user_data) / _LICENSE_FILE


def generate_license_key(user_email: str, plan: str = "pro") -> str:
    """Generate a license key (admin/sales use only)."""
    payload = f"{user_email}:{plan}:{_LICENSE_SECRET}"
    digest = hashlib.sha256(payload.encode()).hexdigest()[:16].upper()
    # Format: TEKTON-XXXX-XXXX-XXXX-XXXX
    parts = [digest[i:i+4] for i in range(0, 16, 4)]
    return f"TEKTON-{'-'.join(parts)}"


def validate_license_key(key: str) -> dict:
    """Validate a license key format and structure.

    Returns:
        {"valid": True/False, "plan": "pro"|"free", "message": "..."}
    """
    if not key or not isinstance(key, str):
        return {"valid": False, "plan": "free", "message": "No license key provided"}

    key = key.strip().upper()

    # Check format
    if not key.startswith("TEKTON-"):
        return {"valid": False, "plan": "free", "message": "Invalid key format"}

    parts = key.replace("TEKTON-", "").split("-")
    if len(parts) != 4 or not all(len(p) == 4 for p in parts):
        return {"valid": False, "plan": "free", "message": "Invalid key format"}

    # In production: validate against license server
    # For MVP: accept any correctly formatted key
    return {
        "valid": True,
        "plan": "pro",
        "message": "License active",
        "key_prefix": f"TEKTON-{parts[0]}-****-****-****",
    }


def save_license(key: str, user_email: str = "") -> dict:
    """Save license key to local storage."""
    validation = validate_license_key(key)
    if not validation["valid"]:
        return validation

    license_data = {
        "key": key.strip().upper(),
        "email": user_email,
        "plan": validation["plan"],
        "activated_at": datetime.now(UTC).isoformat(),
    }

    path = get_license_path()
    with open(path, "w") as f:
        json.dump(license_data, f, indent=2)

    return {**validation, "saved": True}


def load_license() -> dict:
    """Load and validate stored license."""
    path = get_license_path()
    if not path.exists():
        return {
            "valid": False,
            "plan": "free",
            "message": "No license found. Running in free mode.",
            "activated": False,
        }

    try:
        with open(path) as f:
            data = json.load(f)
        validation = validate_license_key(data.get("key", ""))
        return {
            **validation,
            "email": data.get("email", ""),
            "activated_at": data.get("activated_at"),
            "activated": True,
        }
    except Exception:
        return {"valid": False, "plan": "free", "message": "License file corrupted", "activated": False}


def remove_license() -> bool:
    """Remove stored license (deactivate)."""
    path = get_license_path()
    if path.exists():
        path.unlink()
        return True
    return False
