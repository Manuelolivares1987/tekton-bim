"""Panelization API endpoints for SIP and wood frame panels."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.sip_panel_config import SipPanelConfig
from app.models.ifc_element import IfcElement
from app.models.ifc_model import IfcModel
from app.models.wall_opening import WallOpening
from app.services.sip_panelization_service import SipPanelizationService
from app.services.opening_detection_service import OpeningDetectionService
from app.services.wood_frame_service import WoodFrameService
from app.services.panelization_takeoff_service import PanelizationTakeoffService
from app.services.shop_drawing_service import ShopDrawingService
from app.models.wood_frame_config import WoodFrameConfig
from app.schemas.panelization import (
    SipPanelConfigCreate,
    SipPanelConfigUpdate,
    SipPanelConfigResponse,
    WallOpeningCreate,
    WallOpeningResponse,
    PanelizeWallRequest,
    BulkPanelizeRequest,
    PanelInstanceResponse,
    PanelizationResultResponse,
)

router = APIRouter()


# --- SIP Panel Configs ---

@router.post("/sip-configs", response_model=SipPanelConfigResponse)
def create_sip_config(data: SipPanelConfigCreate, db: Session = Depends(get_db)):
    config = SipPanelConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/sip-configs", response_model=list[SipPanelConfigResponse])
def list_sip_configs(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SipPanelConfig)
        .filter(SipPanelConfig.project_id == project_id)
        .order_by(SipPanelConfig.name)
        .all()
    )


@router.get("/sip-configs/{config_id}", response_model=SipPanelConfigResponse)
def get_sip_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(SipPanelConfig).filter(SipPanelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="SIP config not found")
    return config


@router.put("/sip-configs/{config_id}", response_model=SipPanelConfigResponse)
def update_sip_config(config_id: int, data: SipPanelConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(SipPanelConfig).filter(SipPanelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="SIP config not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/sip-configs/{config_id}")
def delete_sip_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(SipPanelConfig).filter(SipPanelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="SIP config not found")
    db.delete(config)
    db.commit()
    return {"detail": "SIP config deleted"}


# --- Wall Openings ---

@router.get("/walls/{element_id}/openings", response_model=list[WallOpeningResponse])
def get_wall_openings(element_id: int, db: Session = Depends(get_db)):
    service = OpeningDetectionService(db)
    return service.get_openings(element_id)


@router.post("/walls/{element_id}/openings", response_model=WallOpeningResponse)
def add_wall_opening(element_id: int, data: WallOpeningCreate, db: Session = Depends(get_db)):
    service = OpeningDetectionService(db)
    return service.add_manual_opening(
        ifc_element_id=element_id,
        opening_type=data.opening_type,
        position_x_mm=data.position_x_mm,
        position_y_mm=data.position_y_mm,
        width_mm=data.width_mm,
        height_mm=data.height_mm,
        rough_opening_width_mm=data.rough_opening_width_mm,
        rough_opening_height_mm=data.rough_opening_height_mm,
    )


@router.delete("/walls/openings/{opening_id}")
def delete_wall_opening(opening_id: int, db: Session = Depends(get_db)):
    service = OpeningDetectionService(db)
    if not service.delete_opening(opening_id):
        raise HTTPException(status_code=404, detail="Opening not found")
    return {"detail": "Opening deleted"}


@router.post("/walls/{element_id}/detect-openings", response_model=list[WallOpeningResponse])
def detect_openings_from_ifc(element_id: int, db: Session = Depends(get_db)):
    """Auto-detect openings from the IFC file for a wall element."""
    element = db.query(IfcElement).filter(IfcElement.id == element_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")

    ifc_model = db.query(IfcModel).filter(IfcModel.id == element.ifc_model_id).first()
    if not ifc_model:
        raise HTTPException(status_code=404, detail="IFC model not found")

    service = OpeningDetectionService(db)
    return service.detect_openings_for_wall(element_id, ifc_model.file_path)


# --- Panelization ---

@router.post("/walls/{element_id}/panelize")
def panelize_wall(
    element_id: int,
    data: PanelizeWallRequest,
    db: Session = Depends(get_db),
):
    """Run SIP panelization on a wall element."""
    element = db.query(IfcElement).filter(IfcElement.id == element_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")

    # Get project_id from the IFC model
    ifc_model = db.query(IfcModel).filter(IfcModel.id == element.ifc_model_id).first()
    if not ifc_model:
        raise HTTPException(status_code=404, detail="IFC model not found")

    service = SipPanelizationService(db)
    try:
        result = service.panelize_wall(
            project_id=ifc_model.project_id,
            ifc_element_id=element_id,
            sip_config_id=data.sip_config_id,
            wall_prefix=data.wall_prefix,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Build response
    return _build_result_response(result, element, db)


@router.get("/walls/{element_id}/result")
def get_wall_panelization(element_id: int, project_id: int, db: Session = Depends(get_db)):
    """Get panelization result for a wall."""
    service = SipPanelizationService(db)
    result = service.get_result(project_id, element_id)
    if not result:
        raise HTTPException(status_code=404, detail="No panelization found for this wall")

    element = db.query(IfcElement).filter(IfcElement.id == element_id).first()
    return _build_result_response(result, element, db)


@router.post("/bulk-panelize")
def bulk_panelize(data: BulkPanelizeRequest, db: Session = Depends(get_db)):
    """Panelize all walls in a model or storey."""
    service = SipPanelizationService(db)
    results = service.bulk_panelize(
        project_id=data.project_id,
        model_id=data.model_id,
        sip_config_id=data.sip_config_id,
        storey_filter=data.storey_filter,
    )
    return {
        "walls_panelized": len(results),
        "total_panels": sum(len(r.panel_instances) for r in results),
    }


@router.get("/results/{project_id}")
def list_panelization_results(project_id: int, db: Session = Depends(get_db)):
    """List all panelization results for a project."""
    service = SipPanelizationService(db)
    return service.get_all_results(project_id)


@router.get("/instances/{result_id}", response_model=list[PanelInstanceResponse])
def get_panel_instances(result_id: int, db: Session = Depends(get_db)):
    """Get panel instances for a panelization result."""
    service = SipPanelizationService(db)
    instances = service.get_instances(result_id)
    if not instances:
        raise HTTPException(status_code=404, detail="No instances found")
    return instances


@router.delete("/results/{result_id}")
def delete_panelization(result_id: int, db: Session = Depends(get_db)):
    service = SipPanelizationService(db)
    if not service.delete_result(result_id):
        raise HTTPException(status_code=404, detail="Result not found")
    return {"detail": "Panelization deleted"}


@router.post("/results/{result_id}/confirm")
def confirm_panelization(result_id: int, db: Session = Depends(get_db)):
    service = SipPanelizationService(db)
    result = service.confirm_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return {"detail": "Panelization confirmed", "status": result.status}


# --- Wood Frame Configs ---

@router.post("/wood-frame-configs")
def create_wood_frame_config(data: dict, db: Session = Depends(get_db)):
    config = WoodFrameConfig(**data)
    db.add(config)
    db.commit()
    db.refresh(config)
    return {
        "id": config.id, "name": config.name,
        "stud_spacing_mm": config.stud_spacing_mm,
        "lumber_size": config.lumber_size,
    }


@router.get("/wood-frame-configs")
def list_wood_frame_configs(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(WoodFrameConfig)
        .filter(WoodFrameConfig.project_id == project_id)
        .all()
    )


@router.delete("/wood-frame-configs/{config_id}")
def delete_wood_frame_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(WoodFrameConfig).filter(WoodFrameConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    db.delete(config)
    db.commit()
    return {"detail": "Wood frame config deleted"}


# --- Framing Generation ---

@router.post("/instances/{instance_id}/generate-framing")
def generate_framing(instance_id: int, wood_frame_config_id: int, db: Session = Depends(get_db)):
    """Generate wood framing members for a panel instance."""
    service = WoodFrameService(db)
    try:
        members = service.generate_framing_for_instance(instance_id, wood_frame_config_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "panel_instance_id": instance_id,
        "member_count": len(members),
        "members": [
            {
                "id": m.id,
                "member_type": m.member_type,
                "position_x_mm": m.position_x_mm,
                "position_y_mm": m.position_y_mm,
                "length_mm": m.length_mm,
                "width_mm": m.width_mm,
                "depth_mm": m.depth_mm,
                "lumber_size": m.lumber_size,
                "quantity": m.quantity,
            }
            for m in members
        ],
    }


@router.get("/instances/{instance_id}/framing")
def get_framing(instance_id: int, db: Session = Depends(get_db)):
    """Get framing members for a panel instance."""
    service = WoodFrameService(db)
    members = service.get_framing(instance_id)
    return {
        "panel_instance_id": instance_id,
        "member_count": len(members),
        "members": [
            {
                "id": m.id,
                "member_type": m.member_type,
                "position_x_mm": m.position_x_mm,
                "position_y_mm": m.position_y_mm,
                "length_mm": m.length_mm,
                "width_mm": m.width_mm,
                "depth_mm": m.depth_mm,
                "lumber_size": m.lumber_size,
                "quantity": m.quantity,
            }
            for m in members
        ],
    }


@router.post("/results/{result_id}/generate-all-framing")
def generate_all_framing(result_id: int, wood_frame_config_id: int, db: Session = Depends(get_db)):
    """Generate wood framing for all panels in a panelization result."""
    service = WoodFrameService(db)
    try:
        count = service.generate_framing_for_result(result_id, wood_frame_config_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"panels_processed": count}


# --- 3D Panel Data ---

@router.get("/3d-data/{project_id}")
def get_3d_panel_data(project_id: int, db: Session = Depends(get_db)):
    """Get panel geometry data for 3D visualization."""
    results = (
        db.query(PanelizationResult)
        .filter(PanelizationResult.project_id == project_id)
        .all()
    )

    walls_3d = []
    for result in results:
        element = db.query(IfcElement).filter(IfcElement.id == result.ifc_element_id).first()
        if not element:
            continue

        config = None
        total_thickness = 0
        if result.config_type == "sip" and result.sip_config_id:
            config = db.query(SipPanelConfig).filter(SipPanelConfig.id == result.sip_config_id).first()
            if config:
                total_thickness = config.core_thickness_mm + 2 * config.skin_thickness_mm

        panels_3d = []
        for instance in result.panel_instances:
            panel_data = {
                "id": instance.id,
                "label": instance.panel_label,
                "position_x_mm": instance.position_x_mm,
                "position_y_mm": instance.position_y_mm,
                "width_mm": instance.width_mm,
                "height_mm": instance.height_mm,
                "thickness_mm": total_thickness or (element.width_m or 0.15) * 1000,
                "panel_type": instance.panel_type,
                "is_custom_cut": instance.is_custom_cut,
                "has_opening": instance.has_opening,
                "opening_type": instance.opening_type,
                "opening_x_mm": instance.opening_x_mm,
                "opening_y_mm": instance.opening_y_mm,
                "opening_width_mm": instance.opening_width_mm,
                "opening_height_mm": instance.opening_height_mm,
                "weight_kg": instance.weight_kg,
                "area_m2": instance.area_m2,
            }

            # Layer data for exploded view
            if config:
                panel_data["layers"] = [
                    {"name": "Piel exterior", "thickness_mm": config.skin_thickness_mm, "color": "#d4a574"},
                    {"name": "Núcleo", "thickness_mm": config.core_thickness_mm, "color": "#f0e68c"},
                    {"name": "Piel interior", "thickness_mm": config.skin_thickness_mm, "color": "#d4a574"},
                ]

            panels_3d.append(panel_data)

        walls_3d.append({
            "wall_id": result.ifc_element_id,
            "wall_name": element.name,
            "storey": element.storey_name,
            "wall_length_mm": (element.length_m or 0) * 1000,
            "wall_height_mm": (element.height_m or 0) * 1000,
            "wall_thickness_mm": total_thickness or (element.width_m or 0.15) * 1000,
            "config_type": result.config_type,
            "panels": panels_3d,
        })

    return {"project_id": project_id, "walls": walls_3d}


# --- Panelization Takeoff (Cubicacion) ---

@router.get("/takeoff/{project_id}/per-panel")
def takeoff_per_panel(project_id: int, waste_factor: float = 1.1, db: Session = Depends(get_db)):
    """Get per-panel material breakdown."""
    service = PanelizationTakeoffService(db)
    return service.per_panel_takeoff(project_id, waste_factor)


@router.get("/takeoff/{project_id}/per-wall")
def takeoff_per_wall(project_id: int, waste_factor: float = 1.1, db: Session = Depends(get_db)):
    """Get per-wall material summary."""
    service = PanelizationTakeoffService(db)
    return service.per_wall_takeoff(project_id, waste_factor)


@router.get("/takeoff/{project_id}/summary")
def takeoff_summary(project_id: int, waste_factor: float = 1.1, db: Session = Depends(get_db)):
    """Get project-wide material summary."""
    service = PanelizationTakeoffService(db)
    return service.project_summary(project_id, waste_factor)


@router.get("/takeoff/{project_id}/export-excel")
def takeoff_export_excel(project_id: int, waste_factor: float = 1.1, db: Session = Depends(get_db)):
    """Export takeoff as Excel file."""
    from fastapi.responses import StreamingResponse
    service = PanelizationTakeoffService(db)
    output = service.export_excel(project_id, waste_factor)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=cubicacion_paneles_{project_id}.xlsx"},
    )


# --- Shop Drawings ---

@router.get("/shop-drawings/{result_id}/wall-elevation.pdf")
def wall_elevation_pdf(result_id: int, db: Session = Depends(get_db)):
    """Generate wall elevation shop drawing PDF."""
    from fastapi.responses import StreamingResponse
    service = ShopDrawingService(db)
    try:
        pdf = service.generate_wall_elevation_pdf(result_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=elevacion_muro_{result_id}.pdf"},
    )


@router.get("/shop-drawings/{project_id}/cutting-list.pdf")
def cutting_list_pdf(project_id: int, db: Session = Depends(get_db)):
    """Generate cutting list PDF."""
    from fastapi.responses import StreamingResponse
    service = ShopDrawingService(db)
    pdf = service.generate_cutting_list_pdf(project_id)
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=lista_corte_{project_id}.pdf"},
    )


@router.get("/shop-drawings/{project_id}/full-set.pdf")
def full_drawing_set_pdf(project_id: int, db: Session = Depends(get_db)):
    """Generate complete shop drawing set PDF."""
    from fastapi.responses import StreamingResponse
    service = ShopDrawingService(db)
    pdf = service.generate_full_set_pdf(project_id)
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=planos_taller_{project_id}.pdf"},
    )


def _build_result_response(result, element, db) -> dict:
    """Build a full panelization result response with panel instances."""
    instances = result.panel_instances
    return {
        "id": result.id,
        "project_id": result.project_id,
        "ifc_element_id": result.ifc_element_id,
        "config_type": result.config_type,
        "sip_config_id": result.sip_config_id,
        "status": result.status,
        "wall_name": element.name if element else None,
        "wall_length_mm": (element.length_m or 0) * 1000 if element else None,
        "wall_height_mm": (element.height_m or 0) * 1000 if element else None,
        "storey": element.storey_name if element else None,
        "panel_count": len(instances),
        "total_area_m2": round(sum(p.area_m2 for p in instances), 2),
        "total_weight_kg": round(sum(p.weight_kg for p in instances), 2),
        "panels": [
            {
                "id": p.id,
                "panel_label": p.panel_label,
                "sequence_order": p.sequence_order,
                "position_x_mm": p.position_x_mm,
                "position_y_mm": p.position_y_mm,
                "width_mm": p.width_mm,
                "height_mm": p.height_mm,
                "is_custom_cut": p.is_custom_cut,
                "has_opening": p.has_opening,
                "opening_type": p.opening_type,
                "opening_x_mm": p.opening_x_mm,
                "opening_y_mm": p.opening_y_mm,
                "opening_width_mm": p.opening_width_mm,
                "opening_height_mm": p.opening_height_mm,
                "panel_type": p.panel_type,
                "weight_kg": p.weight_kg,
                "area_m2": p.area_m2,
                "notes": p.notes,
            }
            for p in instances
        ],
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "updated_at": result.updated_at.isoformat() if result.updated_at else None,
    }
