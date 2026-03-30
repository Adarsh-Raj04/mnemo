"""create mnemo schema

Revision ID: 2babb93e7784
Revises:
Create Date: 2026-03-29 07:34:38.022848

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2babb93e7784"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("CREATE SCHEMA IF NOT EXISTS mnemo")


def downgrade():
    op.execute("DROP SCHEMA IF EXISTS mnemo CASCADE")
