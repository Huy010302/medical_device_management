from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import current_profile
from app.models.db_models import MaintenanceRecord

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

def _payload(model, body: dict):
    allowed = {c.key for c in inspect(model).mapper.column_attrs}
    return {k: v for k, v in body.items() if k in allowed and k not in {"id", "created_at", "updated_at"}}

@router.get("")
def list_items(db: Session = Depends(get_db), current=Depends(current_profile)):
    stmt = select(MaintenanceRecord)
    if hasattr(MaintenanceRecord, "deleted_at"):
        stmt = stmt.where(MaintenanceRecord.deleted_at.is_(None))
    stmt = stmt.order_by(MaintenanceRecord.created_at.desc() if hasattr(MaintenanceRecord.created_at, "desc") else MaintenanceRecord.created_at)
    return db.scalars(stmt).all()

@router.get("/{item_id}")
def get_item(item_id: str, db: Session = Depends(get_db), current=Depends(current_profile)):
    row = db.get(MaintenanceRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="MaintenanceRecord not found")
    return row

@router.post("")
def create_item(body: dict, db: Session = Depends(get_db), current=Depends(current_profile)):
    data = _payload(MaintenanceRecord, body)
    if "id" not in data:
        # text-id tables require an application id
        if MaintenanceRecord.__name__ not in {"Department", "DeviceCategory", "DeviceStatus", "Profile", "Role", "AuthUser", "Device"}:
            import uuid
            data["id"] = str(uuid.uuid4())
    try:
        row = MaintenanceRecord(**data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

@router.patch("/{item_id}")
def update_item(item_id: str, body: dict, db: Session = Depends(get_db), current=Depends(current_profile)):
    row = db.get(MaintenanceRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="MaintenanceRecord not found")
    for key, value in _payload(MaintenanceRecord, body).items():
        setattr(row, key, value)
    try:
        db.commit()
        db.refresh(row)
        return row
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db), current=Depends(current_profile)):
    row = db.get(MaintenanceRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="MaintenanceRecord not found")
    if hasattr(row, "deleted_at"):
        from datetime import datetime, timezone
        row.deleted_at = datetime.now(timezone.utc)
    else:
        db.delete(row)
    try:
        db.commit()
        return {"message": "Deleted", "id": item_id}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
