"""add financial traceability incremental

Revision ID: 20260608_fin_trace
Revises: a617d286d3d0
Create Date: 2026-06-08
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260608_fin_trace"
down_revision: Union[str, None] = "a617d286d3d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add traceability columns safely for databases already migrated before this feature."""
    op.execute("ALTER TABLE financials ADD COLUMN IF NOT EXISTS balance_before NUMERIC(10, 2) DEFAULT 0.00")
    op.execute("ALTER TABLE financials ADD COLUMN IF NOT EXISTS source_type VARCHAR(50)")
    op.execute("ALTER TABLE financials ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)")
    op.execute("ALTER TABLE financials ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100)")
    op.execute("ALTER TABLE financials ADD COLUMN IF NOT EXISTS created_by_user_id UUID")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_financials_created_by_user_id'
            ) THEN
                ALTER TABLE financials
                ADD CONSTRAINT fk_financials_created_by_user_id
                FOREIGN KEY (created_by_user_id) REFERENCES users(id);
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_financials_source_type ON financials (source_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_financials_source_id ON financials (source_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_financials_idempotency_key ON financials (idempotency_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_financials_created_by_user_id ON financials (created_by_user_id)")

    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100)")
    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS balance_before NUMERIC(10, 2)")
    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS balance_after NUMERIC(10, 2)")
    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS requested_by_user_id UUID")
    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS processed_by_user_id UUID")
    op.execute("ALTER TABLE payouts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_payouts_requested_by_user_id'
            ) THEN
                ALTER TABLE payouts
                ADD CONSTRAINT fk_payouts_requested_by_user_id
                FOREIGN KEY (requested_by_user_id) REFERENCES users(id);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_payouts_processed_by_user_id'
            ) THEN
                ALTER TABLE payouts
                ADD CONSTRAINT fk_payouts_processed_by_user_id
                FOREIGN KEY (processed_by_user_id) REFERENCES users(id);
            END IF;
        END $$;
        """
    )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_payouts_idempotency_key ON payouts (idempotency_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payouts_requested_by_user_id ON payouts (requested_by_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payouts_processed_by_user_id ON payouts (processed_by_user_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS payout_status_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
            old_status VARCHAR(30),
            new_status VARCHAR(30) NOT NULL,
            reason TEXT,
            changed_by_user_id UUID REFERENCES users(id),
            balance_before NUMERIC(10, 2),
            balance_after NUMERIC(10, 2),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_payout_status_history_payout_id ON payout_status_history (payout_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payout_status_history_changed_by_user_id ON payout_status_history (changed_by_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payout_status_history_created_at ON payout_status_history (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_payout_status_history_payout_date ON payout_status_history (payout_id, created_at)")


def downgrade() -> None:
    """Remove incremental traceability artifacts.

    This intentionally drops only the incremental artifacts introduced by this revision.
    """
    op.execute("DROP INDEX IF EXISTS idx_payout_status_history_payout_date")
    op.execute("DROP INDEX IF EXISTS ix_payout_status_history_created_at")
    op.execute("DROP INDEX IF EXISTS ix_payout_status_history_changed_by_user_id")
    op.execute("DROP INDEX IF EXISTS ix_payout_status_history_payout_id")
    op.execute("DROP TABLE IF EXISTS payout_status_history")

    op.execute("DROP INDEX IF EXISTS ix_payouts_processed_by_user_id")
    op.execute("DROP INDEX IF EXISTS ix_payouts_requested_by_user_id")
    op.execute("DROP INDEX IF EXISTS ix_payouts_idempotency_key")
    op.execute("ALTER TABLE payouts DROP CONSTRAINT IF EXISTS fk_payouts_processed_by_user_id")
    op.execute("ALTER TABLE payouts DROP CONSTRAINT IF EXISTS fk_payouts_requested_by_user_id")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS processed_by_user_id")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS requested_by_user_id")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS balance_after")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS balance_before")
    op.execute("ALTER TABLE payouts DROP COLUMN IF EXISTS idempotency_key")

    op.execute("DROP INDEX IF EXISTS ix_financials_created_by_user_id")
    op.execute("DROP INDEX IF EXISTS ix_financials_idempotency_key")
    op.execute("DROP INDEX IF EXISTS ix_financials_source_id")
    op.execute("DROP INDEX IF EXISTS ix_financials_source_type")
    op.execute("ALTER TABLE financials DROP CONSTRAINT IF EXISTS fk_financials_created_by_user_id")
    op.execute("ALTER TABLE financials DROP COLUMN IF EXISTS created_by_user_id")
    op.execute("ALTER TABLE financials DROP COLUMN IF EXISTS idempotency_key")
    op.execute("ALTER TABLE financials DROP COLUMN IF EXISTS source_id")
    op.execute("ALTER TABLE financials DROP COLUMN IF EXISTS source_type")
    op.execute("ALTER TABLE financials DROP COLUMN IF EXISTS balance_before")
