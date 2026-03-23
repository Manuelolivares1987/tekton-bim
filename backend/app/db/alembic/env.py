from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so Alembic can detect them for autogenerate
import app.models.project  # noqa
import app.models.ifc_model  # noqa
import app.models.ifc_element  # noqa
import app.models.material  # noqa
import app.models.panel  # noqa
import app.models.panel_layer  # noqa
import app.models.calculation_result  # noqa
import app.models.mep_circuit  # noqa
import app.models.mep_electrical_device  # noqa
import app.models.mep_plumbing_fixture  # noqa
import app.models.mep_pipe_segment  # noqa
import app.models.panel_assignment  # noqa
import app.models.sip_panel_config  # noqa
import app.models.wall_opening  # noqa
import app.models.panelization_result  # noqa
import app.models.wood_frame_config  # noqa
import app.models.framing_member  # noqa
import app.models.floor_plan  # noqa
import app.models.panel_catalog  # noqa
import app.models.building_code  # noqa
import app.models.bim_wall  # noqa
import app.models.bim_wall_opening  # noqa
import app.models.bim_panel  # noqa
import app.models.bim_storey  # noqa
import app.models.wall_group  # noqa

from app.models.base import Base
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
