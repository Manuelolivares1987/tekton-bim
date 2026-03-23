"""normalize constraint names

Revision ID: 9f10b7474ce7
Revises: e6e4d95925ef
Create Date: 2026-03-22 22:03:17.907404

Normalizes foreign key and constraint names to match the naming convention
defined in Base.metadata. This enables Alembic autogenerate to work
reliably for future migrations.

Note: In batch mode (SQLite), the table is recreated with the new
constraint names, so unnamed FKs are handled transparently.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9f10b7474ce7'
down_revision: Union[str, Sequence[str], None] = 'e6e4d95925ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table recreates the table in SQLite, which normalizes
    # all constraint names automatically. We just need to declare the
    # target state.
    with op.batch_alter_table('bim_panels', schema=None) as batch_op:
        # Recreate wall_id FK with proper name and CASCADE
        batch_op.create_foreign_key(
            'fk_bim_panels_wall_id_bim_walls',
            'bim_walls', ['wall_id'], ['id'], ondelete='CASCADE'
        )


def downgrade() -> None:
    with op.batch_alter_table('bim_panels', schema=None) as batch_op:
        batch_op.drop_constraint('fk_bim_panels_wall_id_bim_walls', type_='foreignkey')
