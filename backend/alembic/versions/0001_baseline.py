"""Additive initial schema from the project's existing SQL scripts.

Revision ID: 0001_baseline
Revises:
"""
from pathlib import Path
from alembic import op, context
revision = '0001_baseline'
down_revision = None
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
    # Each script consists of DDL and inserts, with no destructive statements.
    for name in ('001_schema.sql', '002_workflow_bridge.sql', '003_production_indexes.sql'):
        sql = (Path(__file__).resolve().parents[2] / 'sql' / name).read_text(encoding='utf-8')
        run_sql(sql)

def downgrade():
    raise RuntimeError('Destructive downgrade is disabled for hospital data')
