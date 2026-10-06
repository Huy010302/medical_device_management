from datetime import datetime

from sqlalchemy import DateTime, JSON, String, func, ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class WorkflowBase(DeclarativeBase):
    pass

class WorkflowRecord(WorkflowBase):
    __tablename__ = 'workflow_records'
    kind: Mapped[str] = mapped_column(String(40), primary_key=True)
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DeviceEvent(WorkflowBase):
    __tablename__ = "device_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    device_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        nullable=False
    )

class AuditLog(WorkflowBase):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    table_name: Mapped[str] = mapped_column(String(64), nullable=False)
    record_id: Mapped[str] = mapped_column(String(128), nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
