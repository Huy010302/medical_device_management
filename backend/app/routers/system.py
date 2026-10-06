from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_admin

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/db")
def db_check(db: Session = Depends(get_db), current=Depends(require_admin)):
    tables = db.execute(text("""
        select table_name
        from information_schema.tables
        where table_schema='public'
        order by table_name
    """)).scalars().all()
    return {"database": "ok", "tables": tables}
