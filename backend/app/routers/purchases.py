from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import current_profile
from app.models.db_models import PurchaseRecord

router = APIRouter(prefix="/purchases", tags=["purchases"])

def _payload(model, body: dict):
    allowed = {c.key for c in inspect(model).mapper.column_attrs}
    return {k: v for k, v in body.items() if k in allowed and k not in {"id", "created_at", "updated_at"}}

@router.get("")
def list_items(db: Session = Depends(get_db), current=Depends(current_profile)):
    stmt = select(PurchaseRecord)
    if hasattr(PurchaseRecord, "deleted_at"):
        stmt = stmt.where(PurchaseRecord.deleted_at.is_(None))
    stmt = stmt.order_by(PurchaseRecord.purchase_date.desc() if hasattr(PurchaseRecord.purchase_date, "desc") else PurchaseRecord.purchase_date)
    return db.scalars(stmt).all()

@router.get("/{item_id}")
def get_item(item_id: str, db: Session = Depends(get_db), current=Depends(current_profile)):
    row = db.get(PurchaseRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="PurchaseRecord not found")
    return row

@router.post("")
def create_item(body: dict, db: Session = Depends(get_db), current=Depends(current_profile)):
    data = _payload(PurchaseRecord, body)
    if "id" not in data:
        # text-id tables require an application id
        if PurchaseRecord.__name__ not in {"Department", "DeviceCategory", "DeviceStatus", "Profile", "Role", "AuthUser", "Device"}:
            import uuid
            data["id"] = str(uuid.uuid4())
    try:
        row = PurchaseRecord(**data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

@router.patch("/{item_id}")
def update_item(item_id: str, body: dict, db: Session = Depends(get_db), current=Depends(current_profile)):
    row = db.get(PurchaseRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="PurchaseRecord not found")
    for key, value in _payload(PurchaseRecord, body).items():
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
    row = db.get(PurchaseRecord, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="PurchaseRecord not found")
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
