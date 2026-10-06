from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import current_profile
from app.models.workflow_models import WorkflowRecord

router = APIRouter(prefix="/qr", tags=["qr"])

def find_device(db, token):
    row = db.scalar(select(WorkflowRecord).where(WorkflowRecord.kind == 'devices', WorkflowRecord.payload['qr_token'].as_string() == token).limit(1))
    if not row or row.payload.get('deleted_at'): raise HTTPException(404, 'Device not found')
    return row.payload

@router.get('/{qr_token}/internal')
def internal_qr(qr_token: str, db: Session = Depends(get_db), current=Depends(current_profile)):
    device = find_device(db, qr_token)
    records = {}
    for key, kind in (('maintenance','maintenance_records'), ('repairs','repair_records'), ('receptions','reception_records')):
        records[key] = [r.payload for r in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == kind, WorkflowRecord.payload['device_id'].as_string() == device['id']).limit(100)).all()]
    ids = [r['id'] for r in records['repairs']]
    records['replacement_parts'] = [r.payload for r in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == 'replacement_parts', WorkflowRecord.payload['repair_record_id'].as_string().in_(ids)).limit(100)).all()] if ids else []
    return {'device':device, **records}

@router.get('/{qr_token}')
def public_qr(qr_token: str, db: Session = Depends(get_db)):
    d = find_device(db, qr_token)
    return {key:d.get(key) for key in ('id','device_code','name','category','manufacturer','model','current_status','current_location','updated_at')}
