from fastapi import APIRouter, Depends
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import current_profile
from app.models.db_models import Device

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("/qr-list")
def qr_list(
    page:int = 1,
    page_size:int = 50,
    search:str = "",
    status:str|None = None,
    department_id:str|None = None,
    db:Session = Depends(get_db),
    current = Depends(current_profile)
):
    page_size = min(page_size, 50)

    stmt = select(Device).where(
        Device.deleted_at.is_(None)
    )

    if search:
        stmt = stmt.where(
            or_(
                Device.device_code.ilike(f"%{search}%"),
                Device.name.ilike(f"%{search}%")
            )
        )

    if status:
        stmt = stmt.where(Device.current_status == status)

    if department_id:
        stmt = stmt.where(Device.department_id == department_id)

    total = db.scalar(
        select(func.count()).select_from(stmt.subquery())
    )

    items = db.scalars(
        stmt.order_by(Device.device_code)
        .offset((page-1)*page_size)
        .limit(page_size)
    ).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
