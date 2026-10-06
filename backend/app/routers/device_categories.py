from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import current_profile, require_admin
from app.models.db_models import DeviceCategory
from app.models.workflow_models import AuditLog

router = APIRouter(prefix="/device-categories", tags=["device-categories"])

def _payload(model, body: dict):
    allowed = {c.key for c in inspect(model).mapper.column_attrs}
    return {k: v for k, v in body.items() if k in allowed and k not in {"id", "created_at", "updated_at"}}

@router.get("")
def list_items(db: Session = Depends(get_db), current=Depends(current_profile)):
    stmt = select(DeviceCategory)
    if hasattr(DeviceCategory, "deleted_at"):
        stmt = stmt.where(DeviceCategory.deleted_at.is_(None))
    stmt = stmt.order_by(DeviceCategory.name.desc() if hasattr(DeviceCategory.name, "desc") else DeviceCategory.name)
    return db.scalars(stmt).all()

@router.get("/{item_id}")
def get_item(item_id: str, db: Session = Depends(get_db), current=Depends(require_admin)):
    try:
        key = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid ID")
    row = db.get(DeviceCategory, key)
    if not row:
        raise HTTPException(status_code=404, detail="DeviceCategory not found")
    return row

@router.post("")
def create_item(body: dict, db: Session = Depends(get_db), current=Depends(require_admin)):
    data = _payload(DeviceCategory, body)
    if "id" not in data:
        # text-id tables require an application id
        if DeviceCategory.__name__ not in {"Department", "DeviceCategory", "DeviceStatus", "Profile", "Role", "AuthUser", "Device"}:
            import uuid
            data["id"] = str(uuid.uuid4())
    try:
        row = DeviceCategory(**data)
        db.add(row)
        db.flush()
        db.add(AuditLog(user_id=str(current[0].id), action='CREATE', table_name='device_categories', record_id=str(getattr(row, 'id', getattr(row, 'value', ''))), new_value=data))
        db.commit()
        db.refresh(row)
        return row
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

@router.patch("/{item_id}")
def update_item(item_id: str, body: dict, db: Session = Depends(get_db), current=Depends(require_admin)):
    try:
        key = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid ID")
    row = db.get(DeviceCategory, key)
    if not row:
        raise HTTPException(status_code=404, detail="DeviceCategory not found")
    before = {key: getattr(row, key) for key in _payload(DeviceCategory, body)}
    for key, value in _payload(DeviceCategory, body).items():
        if key == "value": continue
        setattr(row, key, value)
    try:
        after = {key: getattr(row, key) for key in before}
        if before != after:
            db.add(AuditLog(user_id=str(current[0].id), action='UPDATE', table_name='device_categories', record_id=item_id, old_value=before, new_value=after))
        db.commit()
        db.refresh(row)
        return row
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db), current=Depends(require_admin)):
    try:
        key = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid ID")
    row = db.get(DeviceCategory, key)
    if not row:
        raise HTTPException(status_code=404, detail="DeviceCategory not found")
    if hasattr(row, "deleted_at"):
        from datetime import datetime, timezone
        row.deleted_at = datetime.now(timezone.utc)
    else:
        row.is_active = False
    try:
        db.add(AuditLog(user_id=str(current[0].id), action='DEACTIVATE', table_name='device_categories', record_id=item_id, old_value={'is_active': True}, new_value={'is_active': False}))
        db.commit()
        return {"message": "Deleted", "id": item_id}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
