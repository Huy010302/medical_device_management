"""JSON document compatibility API for the existing React lifecycle forms.

Records live in PostgreSQL (not localStorage); events are committed in the SAME
transaction as the source change. No untrusted table names become SQL identifiers.
"""
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.core.deps import current_profile
from app.db.session import get_db
from app.models.workflow_models import WorkflowRecord, DeviceEvent, AuditLog

router = APIRouter(prefix='/records', tags=['lifecycle records'])
TABLES = frozenset({
    'devices', 'tendering_records', 'purchase_records', 'reception_records',
    'operation_logs', 'maintenance_records', 'repair_records', 'replacement_parts',
    'transfer_records', 'disposal_records',
})
DEVICE_STATES = frozenset({
    'tendering','approved','purchased','received','operating','maintenance',
    'maintenance_pending','needs_repair','repairing','awaiting_parts',
    'irreparable','disposed',
})
WRITERS = {
    'devices': {'admin', 'asset_manager', 'procurement_officer', 'biomedical_engineer'},
    'tendering_records': {'admin', 'procurement_officer'},
    'purchase_records': {'admin', 'procurement_officer'},
    'reception_records': {'admin', 'procurement_officer', 'asset_manager'},
    'operation_logs': {'admin', 'asset_manager', 'biomedical_engineer', 'clinical_user'},
    'maintenance_records': {'admin', 'asset_manager', 'biomedical_engineer'},
    'repair_records': {'admin', 'asset_manager', 'biomedical_engineer', 'clinical_user'},
    'replacement_parts': {'admin', 'asset_manager', 'biomedical_engineer'},
    'transfer_records': {'admin', 'asset_manager', 'biomedical_engineer'},
    'disposal_records': {'admin', 'asset_manager'},
}

class RecordBody(BaseModel):
    payload: dict = Field(..., description='Complete lifecycle frontend record')


def check_table(table: str):
    if table not in TABLES:
        raise HTTPException(404, 'Unknown record type')


def check_writer(table: str, current):
    _, role = current
    code = role.code if role else ''
    if code not in WRITERS[table]:
        raise HTTPException(403, 'Role cannot modify this record type')


def event_type(table: str, old: dict | None, new: dict) -> str | None:
    if table == 'devices':
        if old is None:
            return 'DEVICE_REGISTERED'
        if new.get('current_status') != old.get('current_status'):
            return 'DEVICE_STATUS_CHANGED'
    if table == 'maintenance_records' and new.get('result') == 'completed' and (not old or old.get('result') != 'completed'):
        return 'MAINTENANCE_COMPLETED'
    if table == 'repair_records' and new.get('repair_status') == 'completed' and (not old or old.get('repair_status') != 'completed'):
        return 'REPAIR_COMPLETED'
    if table == 'transfer_records' and old is None:
        return 'DEVICE_TRANSFERRED'
    if table == 'reception_records' and old is None:
        return 'DEVICE_RECEIVED'
    if table == 'disposal_records' and old is None:
        return 'DEVICE_DISPOSED'
    return None


@router.get('/{table}')
def list_records(table: str, db: Session = Depends(get_db), current=Depends(current_profile)):
    check_table(table)
    if not current[1] or current[1].code == 'pending':
        raise HTTPException(403, 'Account awaiting approval')
    rows = db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == table).order_by(WorkflowRecord.id).limit(100)).all()
    return [r.payload for r in rows]


@router.put('/{table}/{record_id}')
def put_record(table: str, record_id: str, body: RecordBody, db: Session = Depends(get_db), current=Depends(current_profile)):
    check_table(table)
    check_writer(table, current)
    if not record_id or len(record_id) > 128 or body.payload.get('id') != record_id:
        raise HTTPException(422, 'Record ID must match URL and be 1–128 characters')
    payload = body.payload
    if not isinstance(payload, dict): raise HTTPException(422, 'Invalid payload')
    if table == 'devices':
        if not payload.get('device_code') or not payload.get('name') or payload.get('current_status') not in DEVICE_STATES:
            raise HTTPException(422, 'Missing device identity or invalid lifecycle status')
        if db.scalar(select(WorkflowRecord.id).where(WorkflowRecord.kind == table, WorkflowRecord.id != record_id, WorkflowRecord.payload['device_code'].as_string() == payload['device_code']).limit(1)):
            raise HTTPException(409, 'Duplicate device code')
        if not payload.get('qr_token'):
            payload['qr_token'] = str(uuid.uuid4())
        if db.scalar(select(WorkflowRecord.id).where(WorkflowRecord.kind == table, WorkflowRecord.id != record_id, WorkflowRecord.payload['qr_token'].as_string() == payload['qr_token']).limit(1)):
            raise HTTPException(409, 'Duplicate QR token')
    if table in {'maintenance_records', 'repair_records', 'reception_records', 'transfer_records', 'disposal_records', 'operation_logs'}:
        device_id = payload.get('device_id')
        parent = db.get(WorkflowRecord, ('devices', device_id)) if device_id else None
        if not parent or parent.payload.get('deleted_at'):
            raise HTTPException(422, 'Active device does not exist; create the device first')
    old = db.get(WorkflowRecord, (table, record_id))
    before = old.payload if old else None
    if old:
        old.payload = payload
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(old, 'payload')
    else:
        db.add(WorkflowRecord(kind=table, id=record_id, payload=payload))
    kind = event_type(table, before, payload)
    if kind:
        db.add(DeviceEvent(id=str(uuid.uuid4()), device_id=payload.get('device_id') or record_id,
                           event_type=kind, timestamp=datetime.now(timezone.utc),
                           metadata_json={'source_table': table, 'record_id': record_id}))
    if before != payload:
        db.add(AuditLog(user_id=str(current[0].id), action='CREATE' if before is None else 'UPDATE',
                        table_name=table, record_id=record_id, old_value=before, new_value=payload))
    db.commit()
    return payload
