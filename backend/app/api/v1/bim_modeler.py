"""BIM Modeler API - modular SIP panel construction system."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.bim_panel import BimPanel
from app.models.bim_storey import BimStorey
from app.models.panel_catalog import PanelCatalog
from app.models.wall_group import WallGroup
from app.services.bim_bridge_service import BimBridgeService
from app.services.bim_modular_service import BimModularService
from app.services.bim_wall_service import BimWallService
from app.services.wood_frame_service import generate_framing

router = APIRouter()


# ─── Schemas ───

class CatalogCreate(BaseModel):
    project_id: int | None = None
    name: str
    category: str = "full"
    width_mm: float
    height_mm: float
    thickness_mm: float
    core_material_id: int | None = None
    core_thickness_mm: float = 114.0
    skin_material_id: int | None = None
    skin_thickness_mm: float = 11.0


class PanelPlace(BaseModel):
    project_id: int
    panel_catalog_id: int | None = None
    storey_id: int | None = None
    storey_name: str = "Piso 1"
    orientation: str = "wall"  # wall | floor | roof
    pos_x_mm: float
    pos_y_mm: float = 0.0
    pos_z_mm: float
    rotation_deg: float = 0.0
    pitch_deg: float = 0.0
    width_mm: float
    height_mm: float
    thickness_mm: float


class PanelUpdate(BaseModel):
    pos_x_mm: float | None = None
    pos_y_mm: float | None = None
    pos_z_mm: float | None = None
    rotation_deg: float | None = None
    storey_name: str | None = None
    storey_id: int | None = None
    orientation: str | None = None
    pitch_deg: float | None = None


class OpeningAdd(BaseModel):
    opening_type: str = "door"
    opening_x_mm: float = 160.0
    opening_y_mm: float = 0.0
    opening_width_mm: float = 900.0
    opening_height_mm: float = 2100.0


class StoreyCreate(BaseModel):
    name: str
    elevation_mm: float
    floor_height_mm: float = 2440.0


class WallDraw(BaseModel):
    project_id: int
    start_x_mm: float
    start_z_mm: float
    end_x_mm: float
    end_z_mm: float
    storey_id: int | None = None
    height_mm: float = 2440.0
    thickness_mm: float = 136.0
    standard_panel_width_mm: float = 1220.0
    stud_spacing_mm: float = 400.0
    joint_type: str = "tablilla_osb"  # "tablilla_osb" | "lumber_spline"
    plate_count_top: int = 2
    plate_count_bottom: int = 1
    max_lumber_length_mm: float = 3200.0


class WallUpdate(BaseModel):
    start_x_mm: float | None = None
    start_z_mm: float | None = None
    end_x_mm: float | None = None
    end_z_mm: float | None = None
    height_mm: float | None = None
    thickness_mm: float | None = None
    standard_panel_width_mm: float | None = None
    stud_spacing_mm: float | None = None


class WallOpeningAdd(BaseModel):
    opening_type: str = "window"
    position_along_mm: float
    position_y_mm: float = 0.0
    width_mm: float = 1200.0
    height_mm: float = 1200.0


# ─── Walls (primary design entity) ───

@router.post("/walls")
def draw_wall(data: WallDraw, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        return svc.draw_wall(
            project_id=data.project_id,
            start_x_mm=data.start_x_mm,
            start_z_mm=data.start_z_mm,
            end_x_mm=data.end_x_mm,
            end_z_mm=data.end_z_mm,
            storey_id=data.storey_id,
            height_mm=data.height_mm,
            thickness_mm=data.thickness_mm,
            standard_panel_width_mm=data.standard_panel_width_mm,
            stud_spacing_mm=data.stud_spacing_mm,
            joint_type=data.joint_type,
            plate_count_top=data.plate_count_top,
            plate_count_bottom=data.plate_count_bottom,
            max_lumber_length_mm=data.max_lumber_length_mm,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/project/{project_id}/walls")
def list_walls(project_id: int, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    return svc.list_walls(project_id)


@router.get("/walls/{wall_id}/assembly")
def get_wall_assembly(wall_id: int, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        return svc.get_wall_assembly(wall_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.put("/walls/{wall_id}")
def update_wall(wall_id: int, data: WallUpdate, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        return svc.update_wall(wall_id, **data.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/walls/{wall_id}")
def delete_wall(wall_id: int, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        svc.delete_wall(wall_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"detail": "Wall deleted"}


@router.post("/walls/{wall_id}/openings")
def add_wall_opening(wall_id: int, data: WallOpeningAdd, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        return svc.add_opening(
            wall_id=wall_id,
            opening_type=data.opening_type,
            position_along_mm=data.position_along_mm,
            position_y_mm=data.position_y_mm,
            width_mm=data.width_mm,
            height_mm=data.height_mm,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/walls/{wall_id}/openings/{opening_id}")
def remove_wall_opening(wall_id: int, opening_id: int, db: Session = Depends(get_db)):
    svc = BimWallService(db)
    try:
        return svc.remove_opening(wall_id, opening_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ─── Catalog ───

@router.get("/catalogs")
def list_catalog(project_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(PanelCatalog)
    if project_id:
        query = query.filter(
            (PanelCatalog.project_id == project_id) | (PanelCatalog.project_id.is_(None))
        )
    else:
        query = query.filter(PanelCatalog.project_id.is_(None))
    return [_catalog_to_dict(c) for c in query.order_by(PanelCatalog.name).all()]


@router.post("/catalogs")
def create_catalog(data: CatalogCreate, db: Session = Depends(get_db)):
    area = (data.width_mm / 1000) * (data.height_mm / 1000)
    skin_weight = 2 * area * (data.skin_thickness_mm / 1000) * 640
    core_weight = area * (data.core_thickness_mm / 1000) * 20
    weight = round(skin_weight + core_weight, 2)

    catalog = PanelCatalog(**data.model_dump(), weight_kg=weight)
    db.add(catalog)
    db.commit()
    db.refresh(catalog)
    return _catalog_to_dict(catalog)


@router.delete("/catalogs/{catalog_id}")
def delete_catalog(catalog_id: int, db: Session = Depends(get_db)):
    item = db.query(PanelCatalog).filter(PanelCatalog.id == catalog_id).first()
    if not item:
        raise HTTPException(404, "Catalog item not found")
    db.delete(item)
    db.commit()
    return {"detail": "Deleted"}


# ─── Panels ───

@router.get("/project/{project_id}/panels")
def list_panels(project_id: int, db: Session = Depends(get_db)):
    panels = (
        db.query(BimPanel)
        .filter(BimPanel.project_id == project_id)
        .order_by(BimPanel.label)
        .all()
    )
    return [_panel_to_dict(p) for p in panels]


@router.post("/panels")
def place_panel(data: PanelPlace, db: Session = Depends(get_db)):
    # Auto label based on orientation
    prefix = {"wall": "SIP", "floor": "LOS", "roof": "TEC"}.get(data.orientation, "SIP")
    count = db.query(BimPanel).filter(
        BimPanel.project_id == data.project_id,
        BimPanel.orientation == data.orientation,
    ).count()
    label = f"{prefix}-{count + 1:03d}"

    panel = BimPanel(
        project_id=data.project_id,
        panel_catalog_id=data.panel_catalog_id,
        storey_id=data.storey_id,
        label=label,
        storey_name=data.storey_name,
        orientation=data.orientation,
        pos_x_mm=data.pos_x_mm,
        pos_y_mm=data.pos_y_mm,
        pos_z_mm=data.pos_z_mm,
        rotation_deg=data.rotation_deg,
        pitch_deg=data.pitch_deg,
        width_mm=data.width_mm,
        height_mm=data.height_mm,
        thickness_mm=data.thickness_mm,
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return _panel_to_dict(panel)


@router.put("/panels/{panel_id}")
def update_panel(panel_id: int, data: PanelUpdate, db: Session = Depends(get_db)):
    panel = db.query(BimPanel).filter(BimPanel.id == panel_id).first()
    if not panel:
        raise HTTPException(404, "Panel not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(panel, key, value)
    db.commit()
    db.refresh(panel)
    return _panel_to_dict(panel)


@router.delete("/panels/{panel_id}")
def delete_panel(panel_id: int, db: Session = Depends(get_db)):
    panel = db.query(BimPanel).filter(BimPanel.id == panel_id).first()
    if not panel:
        raise HTTPException(404, "Panel not found")
    db.delete(panel)
    db.commit()
    return {"detail": "Panel deleted"}


@router.post("/panels/{panel_id}/add-opening")
def add_opening(panel_id: int, data: OpeningAdd, db: Session = Depends(get_db)):
    panel = db.query(BimPanel).filter(BimPanel.id == panel_id).first()
    if not panel:
        raise HTTPException(404, "Panel not found")
    panel.has_opening = True
    panel.opening_type = data.opening_type
    panel.opening_x_mm = data.opening_x_mm
    panel.opening_y_mm = data.opening_y_mm
    panel.opening_width_mm = data.opening_width_mm
    panel.opening_height_mm = data.opening_height_mm
    db.commit()
    return _panel_to_dict(panel)


@router.delete("/panels/{panel_id}/remove-opening")
def remove_opening(panel_id: int, db: Session = Depends(get_db)):
    panel = db.query(BimPanel).filter(BimPanel.id == panel_id).first()
    if not panel:
        raise HTTPException(404, "Panel not found")
    panel.has_opening = False
    panel.opening_type = None
    panel.opening_x_mm = None
    panel.opening_y_mm = None
    panel.opening_width_mm = None
    panel.opening_height_mm = None
    db.commit()
    return _panel_to_dict(panel)


# ─── Framing ───

@router.get("/panels/{panel_id}/framing")
def get_panel_framing(panel_id: int, db: Session = Depends(get_db)):
    """Generate framing members for a BIM panel on-the-fly."""
    panel = db.query(BimPanel).filter(BimPanel.id == panel_id).first()
    if not panel:
        raise HTTPException(404, "Panel not found")
    if panel.orientation != "wall":
        return []

    members = generate_framing(
        panel_width_mm=panel.width_mm,
        panel_height_mm=panel.height_mm,
        stud_spacing_mm=400.0,
        stud_width_mm=38.0,
        stud_depth_mm=89.0,
        lumber_size="2x4",
        plate_count_top=2,
        plate_count_bottom=1,
        has_opening=panel.has_opening,
        opening_x_mm=panel.opening_x_mm or 0,
        opening_y_mm=panel.opening_y_mm or 0,
        opening_width_mm=panel.opening_width_mm or 0,
        opening_height_mm=panel.opening_height_mm or 0,
        opening_type=panel.opening_type,
    )
    return [_member_to_dict(m) for m in members]


@router.get("/project/{project_id}/wall-framing")
def get_wall_framing(project_id: int, db: Session = Depends(get_db)):
    """Generate framing for all wall panels with connection studs."""
    import math

    panels = (
        db.query(BimPanel)
        .filter(BimPanel.project_id == project_id, BimPanel.orientation == "wall")
        .order_by(BimPanel.pos_x_mm, BimPanel.pos_z_mm)
        .all()
    )
    if not panels:
        return []

    STUD_W = 38.0
    STUD_D = 89.0
    TOLERANCE = 50.0  # mm

    result = []

    for panel in panels:
        # Generate individual panel framing
        members = generate_framing(
            panel_width_mm=panel.width_mm,
            panel_height_mm=panel.height_mm,
            stud_spacing_mm=400.0,
            stud_width_mm=STUD_W,
            stud_depth_mm=STUD_D,
            lumber_size="2x4",
            plate_count_top=2,
            plate_count_bottom=1,
            has_opening=panel.has_opening,
            opening_x_mm=panel.opening_x_mm or 0,
            opening_y_mm=panel.opening_y_mm or 0,
            opening_width_mm=panel.opening_width_mm or 0,
            opening_height_mm=panel.opening_height_mm or 0,
            opening_type=panel.opening_type,
        )

        for m in members:
            result.append({
                **_member_to_dict(m),
                "panel_id": panel.id,
                "panel_label": panel.label,
                # World position for rendering
                "world_x_mm": panel.pos_x_mm,
                "world_y_mm": panel.pos_y_mm,
                "world_z_mm": panel.pos_z_mm,
                "panel_rotation_deg": panel.rotation_deg,
            })

    # Detect adjacent panels and add connection studs
    for i, p1 in enumerate(panels):
        rad1 = math.radians(p1.rotation_deg)
        cos1 = math.cos(rad1)
        sin1 = math.sin(rad1)
        # Right edge of p1
        p1_right_x = p1.pos_x_mm + cos1 * p1.width_mm
        p1_right_z = p1.pos_z_mm + sin1 * p1.width_mm

        for p2 in panels[i + 1:]:
            # Check if p2 origin touches p1 right edge (inline connection)
            if abs(p1.rotation_deg - p2.rotation_deg) > 1:
                continue
            if abs(p1.pos_y_mm - p2.pos_y_mm) > TOLERANCE:
                continue

            dx = abs(p2.pos_x_mm - p1_right_x)
            dz = abs(p2.pos_z_mm - p1_right_z)
            dist = math.sqrt(dx * dx + dz * dz)

            if dist < TOLERANCE:
                # Connection stud at the joint
                stud_height = p1.height_mm - STUD_W * 3  # between plates
                result.append({
                    "member_type": "connection_stud",
                    "position_x_mm": p1.width_mm - STUD_W / 2,
                    "position_y_mm": STUD_W,  # above bottom plate
                    "length_mm": stud_height,
                    "width_mm": STUD_W,
                    "depth_mm": STUD_D,
                    "lumber_size": "2x4",
                    "quantity": 1,
                    "panel_id": p1.id,
                    "panel_label": f"{p1.label}-{p2.label}",
                    "world_x_mm": p1.pos_x_mm,
                    "world_y_mm": p1.pos_y_mm,
                    "world_z_mm": p1.pos_z_mm,
                    "panel_rotation_deg": p1.rotation_deg,
                })

    return result


def _member_to_dict(m) -> dict:
    return {
        "member_type": m.member_type,
        "position_x_mm": m.position_x_mm,
        "position_y_mm": m.position_y_mm,
        "length_mm": m.length_mm,
        "width_mm": m.width_mm,
        "depth_mm": m.depth_mm,
        "lumber_size": m.lumber_size,
        "quantity": m.quantity,
    }


# ─── Storeys ───

@router.get("/project/{project_id}/storeys")
def list_storeys(project_id: int, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    storeys = svc.list_storeys(project_id)
    return [_storey_to_dict(s) for s in storeys]


@router.post("/project/{project_id}/storeys")
def create_storey(project_id: int, data: StoreyCreate, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    storey = svc.add_storey(project_id, data.name, data.elevation_mm, data.floor_height_mm)
    return _storey_to_dict(storey)


@router.delete("/storeys/{storey_id}")
def delete_storey(storey_id: int, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    try:
        svc.delete_storey(storey_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"detail": "Storey deleted"}


# ─── Wall groups ───

@router.post("/project/{project_id}/auto-group-walls")
def auto_group_walls(project_id: int, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    return svc.auto_group_walls(project_id)


@router.get("/project/{project_id}/wall-groups")
def list_wall_groups(project_id: int, db: Session = Depends(get_db)):
    groups = (
        db.query(WallGroup)
        .filter(WallGroup.project_id == project_id)
        .order_by(WallGroup.name)
        .all()
    )
    return [_wall_group_to_dict(g) for g in groups]


# ─── Connections ───

@router.get("/project/{project_id}/connections")
def get_connections(project_id: int, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    return svc.get_connections(project_id)


# ─── Summary ───

@router.get("/project/{project_id}/summary")
def project_summary(project_id: int, db: Session = Depends(get_db)):
    svc = BimModularService(db)
    return svc.get_modular_summary(project_id)


# ─── Bridge ───

@router.post("/project/{project_id}/generate-elements")
def generate_elements(project_id: int, db: Session = Depends(get_db)):
    service = BimBridgeService(db)
    try:
        return service.generate_elements(project_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ─── Helpers ───

def _catalog_to_dict(c: PanelCatalog) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "name": c.name,
        "category": c.category,
        "width_mm": c.width_mm,
        "height_mm": c.height_mm,
        "thickness_mm": c.thickness_mm,
        "core_thickness_mm": c.core_thickness_mm,
        "skin_thickness_mm": c.skin_thickness_mm,
        "weight_kg": c.weight_kg,
    }


def _panel_to_dict(p: BimPanel) -> dict:
    return {
        "id": p.id,
        "project_id": p.project_id,
        "panel_catalog_id": p.panel_catalog_id,
        "wall_group_id": p.wall_group_id,
        "storey_id": p.storey_id,
        "label": p.label,
        "storey_name": p.storey_name,
        "orientation": p.orientation or "wall",
        "pos_x_mm": p.pos_x_mm,
        "pos_y_mm": p.pos_y_mm,
        "pos_z_mm": p.pos_z_mm,
        "rotation_deg": p.rotation_deg,
        "pitch_deg": p.pitch_deg or 0.0,
        "width_mm": p.width_mm,
        "height_mm": p.height_mm,
        "thickness_mm": p.thickness_mm,
        "has_opening": p.has_opening,
        "opening_type": p.opening_type,
        "opening_x_mm": p.opening_x_mm,
        "opening_y_mm": p.opening_y_mm,
        "opening_width_mm": p.opening_width_mm,
        "opening_height_mm": p.opening_height_mm,
        "ifc_element_id": p.ifc_element_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _storey_to_dict(s: BimStorey) -> dict:
    return {
        "id": s.id,
        "project_id": s.project_id,
        "name": s.name,
        "level_index": s.level_index,
        "elevation_mm": s.elevation_mm,
        "floor_height_mm": s.floor_height_mm,
    }


def _wall_group_to_dict(g: WallGroup) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "storey_id": g.storey_id,
        "axis_angle_deg": g.axis_angle_deg,
        "total_length_mm": g.total_length_mm,
        "panel_count": g.panel_count,
        "panels": [p.label for p in g.panels] if g.panels else [],
    }


def _group_by_storey(panels: list[BimPanel]) -> dict:
    groups: dict[str, int] = {}
    for p in panels:
        s = p.storey_name or "Sin piso"
        groups[s] = groups.get(s, 0) + 1
    return groups
