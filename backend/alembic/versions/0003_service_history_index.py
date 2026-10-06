"""Index service history lookups by device without modifying hospital records.

Revision ID: 0003_service_history_index
Revises: 0002_audit
"""
from alembic import op

revision = '0003_service_history_index'
down_revision = '0002_audit'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_workflow_service_device
        ON workflow_records ((payload ->> 'device_id'))
        WHERE kind IN ('maintenance_records', 'repair_records', 'replacement_parts')
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_device_events_service_history
        ON device_events (device_id, timestamp DESC)
        WHERE event_type IN ('MAINTENANCE_COMPLETED', 'REPAIR_COMPLETED')
    """)


def downgrade():
    raise RuntimeError('Destructive downgrade is disabled for hospital data')
