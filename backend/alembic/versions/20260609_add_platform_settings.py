"""add platform settings

Revision ID: 20260609_platform_settings
Revises: 20260608_fin_trace
Create Date: 2026-06-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260609_platform_settings"
down_revision: Union[str, None] = "20260608_fin_trace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_NAME = "platform_settings"


def _table_exists() -> bool:
    return sa.inspect(op.get_bind()).has_table(TABLE_NAME)


def _column_names() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(TABLE_NAME)}


def upgrade() -> None:
    """Create platform settings, tolerating DBs where create_all already created it."""
    if not _table_exists():
        op.create_table(
            TABLE_NAME,
            sa.Column("key", sa.String(length=100), nullable=False),
            sa.Column("value", sa.JSON(), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("updated_by_user_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("key"),
        )
    else:
        # Some development deployments run SQLAlchemy Base.metadata.create_all()
        # before Alembic. In that case the table exists but the revision is not
        # stamped yet, so upgrade must be additive/idempotent instead of failing.
        columns = _column_names()
        if "value" not in columns:
            op.add_column(
                TABLE_NAME,
                sa.Column("value", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
            )
            op.alter_column(TABLE_NAME, "value", server_default=None)
        if "description" not in columns:
            op.add_column(TABLE_NAME, sa.Column("description", sa.String(length=255), nullable=True))
        if "updated_by_user_id" not in columns:
            op.add_column(TABLE_NAME, sa.Column("updated_by_user_id", sa.UUID(), nullable=True))
            op.create_foreign_key(
                "fk_platform_settings_updated_by_user_id_users",
                TABLE_NAME,
                "users",
                ["updated_by_user_id"],
                ["id"],
            )
        if "created_at" not in columns:
            op.add_column(
                TABLE_NAME,
                sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
            )
        if "updated_at" not in columns:
            op.add_column(TABLE_NAME, sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.execute('CREATE INDEX IF NOT EXISTS ix_platform_settings_key ON platform_settings ("key")')
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_settings_updated_by_user_id "
        "ON platform_settings (updated_by_user_id)"
    )


def downgrade() -> None:
    if _table_exists():
        op.execute("DROP INDEX IF EXISTS ix_platform_settings_updated_by_user_id")
        op.execute("DROP INDEX IF EXISTS ix_platform_settings_key")
        op.drop_table(TABLE_NAME)
