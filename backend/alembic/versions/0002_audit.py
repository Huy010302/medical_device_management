"""Audit table and workflow status options.

Revision ID: 0002_audit
Revises: 0001_baseline
"""
from pathlib import Path
from alembic import op, context
revision = '0002_audit'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None

def run_sql(sql):
    if context.is_offline_mode():
        op.execute(sql)
    else:
        # Psycopg simple query mode accepts a schema script with multiple statements.
        # Uses Alembic's current transaction; there is no implicit commit.
        raw = op.get_bind().connection.driver_connection
        with raw.cursor() as cursor:
            cursor.execute(sql, prepare=False)

def upgrade():
    sql = (Path(__file__).resolve().parents[2] / 'sql' / '004_audit_and_statuses.sql').read_text(encoding='utf-8')
    run_sql(sql)

def downgrade():
    raise RuntimeError('Destructive downgrade is disabled for hospital data')
