"""Paged reads over the workflow JSON documents used by the React forms."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from app.core.deps import current_profile
from app.db.session import get_db
from app.models.workflow_models import WorkflowRecord, DeviceEvent
from app.models.db_models import MaintenanceRecord, RepairRecord, ReplacementPart, Device

router = APIRouter(tags=['paged records'])
def approved_profile(current=Depends(current_profile)):
    if not current[1] or current[1].code == 'pending': raise HTTPException(403, 'Account awaiting approval')
    return current

@router.get('/devices/{device_id}/service-history')
def device_service_history(device_id: str, db: Session = Depends(get_db), current=Depends(approved_profile)):
    """Read the complete service history for one device from both supported stores.

    The global /records endpoint intentionally loads only 100 rows; it must never
    be used to calculate per-device costs. Existing relational records are read
    without moving or rewriting hospital data.
    """
    workflow_device = db.get(WorkflowRecord, ('devices', device_id))
    relational_device = db.get(Device, device_id)
    if (not workflow_device or workflow_device.payload.get('deleted_at')) and (not relational_device or relational_device.deleted_at):
        raise HTTPException(404, 'Device not found')

    kinds = ('maintenance_records', 'repair_records', 'replacement_parts')
    rows = db.scalars(select(WorkflowRecord).where(
        WorkflowRecord.kind.in_(kinds), WorkflowRecord.payload['device_id'].as_string() == device_id
    ).order_by(WorkflowRecord.updated_at.desc(), WorkflowRecord.id)).all()
    records = {kind: [dict(row.payload, _source='workflow') for row in rows if row.kind == kind] for kind in kinds}
    seen = {kind: {row['id'] for row in records[kind]} for kind in kinds}

    for row in db.scalars(select(MaintenanceRecord).where(MaintenanceRecord.device_id == device_id)).all():
        if row.id not in seen['maintenance_records']:
            records['maintenance_records'].append({
                'id': row.id, 'device_id': device_id, 'maintenance_type': row.maintenance_type or '',
                'scheduled_date': str(row.scheduled_date or ''), 'actual_date': str(row.actual_date or ''),
                'performed_by': row.performed_by or '', 'service_company': row.service_company or '',
                'description': row.description or '', 'result': row.result or '',
                'cost': float(row.cost or 0), 'next_maintenance_date': str(row.next_maintenance_date or ''),
                'attachments': [], 'created_at': row.created_at.isoformat() if row.created_at else '', '_source': 'legacy',
            })
    for row in db.scalars(select(RepairRecord).where(RepairRecord.device_id == device_id)).all():
        if row.id not in seen['repair_records']:
            records['repair_records'].append({
                'id': row.id, 'device_id': device_id, 'report_date': str(row.report_date or ''),
                'fault_description': row.fault_description or '', 'fault_category': row.fault_category or '',
                'repair_start_date': str(row.repair_start_date or ''), 'repair_end_date': str(row.repair_end_date or ''),
                'technician': row.technician or '', 'repair_company': row.repair_company or '',
                'repair_description': '', 'total_cost': float(row.total_cost or 0),
                'repair_status': row.repair_status or 'reported', 'warranty_claim': False,
                'attachments': [], 'created_at': '', '_source': 'legacy',
            })
    legacy_repairs = set(db.scalars(select(RepairRecord.id).where(RepairRecord.device_id == device_id)).all())
    if legacy_repairs:
        for row in db.scalars(select(ReplacementPart).where(ReplacementPart.repair_record_id.in_(legacy_repairs))).all():
            if row.id not in seen['replacement_parts']:
                records['replacement_parts'].append({
                    'id': row.id, 'device_id': device_id, 'repair_record_id': row.repair_record_id,
                    'replacement_date': str(row.replacement_date or ''), 'part_name': row.part_name or '',
                    'part_code': row.part_code or '', 'quantity': row.quantity or 0,
                    'unit_price': float(row.unit_price or 0), 'vendor': row.vendor or '',
                    'part_status': 'installed', 'attachments': [], 'created_at': '', '_source': 'legacy',
                })

    events = db.scalars(select(DeviceEvent).where(
        DeviceEvent.device_id == device_id,
        DeviceEvent.event_type.in_(('MAINTENANCE_COMPLETED', 'REPAIR_COMPLETED'))
    ).order_by(DeviceEvent.timestamp.desc()).limit(100)).all()
    return {**records, 'events': [
        {'id': e.id, 'event_type': e.event_type, 'timestamp': e.timestamp.isoformat(), 'metadata': e.metadata_json or {}}
        for e in events
    ]}

def page_records(kind, page, page_size, search, fields, filters, db):
    p = WorkflowRecord.payload
    stmt = select(WorkflowRecord).where(WorkflowRecord.kind == kind)
    if kind == 'devices':
        stmt = stmt.where(or_(p['deleted_at'].as_string().is_(None), p['deleted_at'].as_string() == ''))
    if search.strip():
        pattern = '%' + search.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        stmt = stmt.where(or_(*(p[field].as_string().ilike(pattern, escape='\\') for field in fields)))
    for field, value in filters.items():
        if value:
            stmt = stmt.where(p[field].as_string() == value)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(WorkflowRecord.updated_at.desc(), WorkflowRecord.id).offset((page - 1) * page_size).limit(page_size)).all()
    return {'items': [r.payload for r in rows], 'page': page, 'page_size': page_size, 'total': total, 'total_pages': (total + page_size - 1) // page_size}

@router.get('/devices')
def devices(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), search: str = Query('', max_length=120), department_id: str | None = None, category_id: str | None = None, status: str | None = None, db: Session = Depends(get_db), current=Depends(approved_profile)):
    return page_records('devices', page, page_size, search, ('device_code','name','serial_number','asset_code'), {'department_id':department_id,'category_id':category_id,'current_status':status}, db)

@router.get('/tendering')
def tendering(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str = Query('', max_length=120), status: str | None = None, year: int | None = Query(None, ge=1900, le=2200), db: Session = Depends(get_db), current=Depends(approved_profile)):
    filters = {'tender_status':status}
    return _dated('tendering_records',page,page_size,search,('tender_code','tender_name','winning_vendor'),filters,'tender_date',year,db)

@router.get('/purchases')
def purchases(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str = Query('', max_length=120), status: str | None = None, year: int | None = Query(None, ge=1900, le=2200), date_from: str | None = Query(None, pattern=r'^\d{4}-\d{2}-\d{2}$'), date_to: str | None = Query(None, pattern=r'^\d{4}-\d{2}-\d{2}$'), db: Session = Depends(get_db), current=Depends(approved_profile)):
    return _dated('purchase_records',page,page_size,search,('contract_number','vendor_name'),{'purchase_status':status},'contract_date',year,db,date_from,date_to)

def _dated(kind,page,page_size,search,fields,filters,date_field,year,db,date_from=None,date_to=None):
    # Prefix comparison uses the ISO date already stored in workflow payloads.
    from sqlalchemy import and_
    p = WorkflowRecord.payload
    stmt = select(WorkflowRecord).where(WorkflowRecord.kind == kind)
    if search.strip():
        pattern = '%' + search.strip().replace('\\','\\\\').replace('%','\\%').replace('_','\\_') + '%'
        stmt = stmt.where(or_(*(p[field].as_string().ilike(pattern, escape='\\') for field in fields)))
    for field,value in filters.items():
        if value: stmt = stmt.where(p[field].as_string() == value)
    if year: stmt = stmt.where(p[date_field].as_string().like(f'{year}-%'))
    if date_from: stmt = stmt.where(p[date_field].as_string() >= date_from)
    if date_to: stmt = stmt.where(p[date_field].as_string() <= date_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(WorkflowRecord.updated_at.desc(), WorkflowRecord.id).offset((page-1)*page_size).limit(page_size)).all()
    return {'items':[r.payload for r in rows], 'page':page, 'page_size':page_size,'total':total,'total_pages':(total+page_size-1)//page_size}

@router.get('/qr/devices')
def qr_devices(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), search: str = Query('', max_length=120), department_id: str | None = None, category_id: str | None = None, status: str | None = None, db: Session = Depends(get_db), current=Depends(approved_profile)):
    result = page_records('devices',page,page_size,search,('device_code','name'),{'department_id':department_id,'category_id':category_id,'current_status':status},db)
    result['items'] = [{k:d.get(k) for k in ('id','device_code','name','qr_token','department_id','current_status')} for d in result['items']]
    return result


def _page_with_devices(kind, page, page_size, search, fields, filters, db):
    """Paged workflow records + device_code/device_name/current_status of each device."""
    result = page_records(kind, page, page_size, search, fields, filters, db)
    ids = list({i.get('device_id') for i in result['items'] if i.get('device_id')})
    info = {}
    if ids:
        for row in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == 'devices', WorkflowRecord.id.in_(ids))).all():
            info[row.id] = row.payload
    for item in result['items']:
        d = info.get(item.get('device_id'), {})
        item['device_code'] = d.get('device_code', '')
        item['device_name'] = d.get('name', '')
        item['device_status'] = d.get('current_status', '')
    return result

@router.get('/maintenance-records')
def maintenance_records_paged(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str = Query('', max_length=120), result: str | None = None, db: Session = Depends(get_db), current=Depends(approved_profile)):
    return _page_with_devices('maintenance_records', page, page_size, search, ('device_id', 'performed_by', 'service_company', 'description'), {'result': result}, db)

@router.get('/repair-records')
def repair_records_paged(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str = Query('', max_length=120), status: str | None = None, db: Session = Depends(get_db), current=Depends(approved_profile)):
    return _page_with_devices('repair_records', page, page_size, search, ('device_id', 'fault_description', 'repair_company', 'technician'), {'repair_status': status}, db)


@router.get('/disposal-records')
def disposal_records_paged(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), search: str = Query('', max_length=120), method: str | None = None, db: Session = Depends(get_db), current=Depends(approved_profile)):
    return _page_with_devices('disposal_records', page, page_size, search, ('device_id', 'reason', 'decision_number'), {'disposal_method': method}, db)
