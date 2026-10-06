from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_admin
from app.models.db_models import Profile, Role

router = APIRouter(prefix="/profiles", tags=["profiles"])

@router.get("")
def list_profiles(db: Session = Depends(get_db), current=Depends(require_admin)):
    rows = db.scalars(select(Profile).order_by(Profile.created_at.desc())).all()
    return rows
