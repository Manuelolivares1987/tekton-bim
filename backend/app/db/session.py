from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite specific
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def init_db():
    import app.models.bim_panel  # noqa: F401
    import app.models.bim_storey  # noqa: F401
    import app.models.bim_wall  # noqa: F401
    import app.models.bim_wall_opening  # noqa: F401
    import app.models.building_code  # noqa: F401
    import app.models.calculation_result  # noqa: F401
    import app.models.floor_plan  # noqa: F401
    import app.models.framing_member  # noqa: F401
    import app.models.ifc_element  # noqa: F401
    import app.models.ifc_model  # noqa: F401
    import app.models.material  # noqa: F401
    import app.models.mep_circuit  # noqa: F401
    import app.models.mep_electrical_device  # noqa: F401
    import app.models.mep_pipe_segment  # noqa: F401
    import app.models.mep_plumbing_fixture  # noqa: F401
    import app.models.panel  # noqa: F401
    import app.models.panel_assignment  # noqa: F401
    import app.models.panel_catalog  # noqa: F401
    import app.models.panel_layer  # noqa: F401
    import app.models.panelization_result  # noqa: F401

    # Import all models so they register with Base.metadata
    import app.models.project  # noqa: F401
    import app.models.sip_panel_config  # noqa: F401
    import app.models.wall_group  # noqa: F401
    import app.models.wall_opening  # noqa: F401
    import app.models.wood_frame_config  # noqa: F401
    from app.models.base import Base

    Base.metadata.create_all(bind=engine)


async def close_db():
    engine.dispose()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
