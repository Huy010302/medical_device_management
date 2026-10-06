import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.routers import devices
from app.routers import departments
from app.routers import device_categories
from app.routers import device_statuses
from app.routers import maintenance
from app.routers import repairs
from app.routers import replacement_parts
from app.routers import transfers
from app.routers import disposals
from app.routers import tendering
from app.routers import purchases
from app.routers import receptions
from app.routers import auth, profiles, admin, analytics, qr, system, workflow
from app.routers import qr_batch, paged_records

app = FastAPI(title=settings.app_name, version="2.4.0")
logger = logging.getLogger(__name__)

@app.exception_handler(DBAPIError)
async def database_error(request, exc: DBAPIError):
    logger.exception("Database request failed: %s %s", request.method, request.url.path)
    sqlstate = getattr(exc.orig, "sqlstate", None)
    if sqlstate in {"42P01", "42703"}:
        return JSONResponse(status_code=503, content={"detail":
            "Database schema incomplete. Run alembic upgrade head in backend, then restart the backend."})
    return JSONResponse(status_code=500, content={"detail":
        f"Database request failed (SQLSTATE {sqlstate or 'unknown'}). Check the FastAPI log."})


app.include_router(qr_batch.router, prefix="/api")
app.include_router(paged_records.router, prefix="/api")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "version": "2.4.0"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    names = ("auth_users", "profiles", "workflow_records", "device_events", "audit_logs", "device_categories")
    missing = [name for name in names if db.scalar(text("select to_regclass(:name)"), {"name": name}) is None]
    if missing:
        raise HTTPException(status_code=503, detail={"message": "Database migration required", "missing_tables": missing})
    db.execute(text("select is_active from device_categories limit 0"))
    return {"status": "ready", "version": "2.4.0"}

app.include_router(auth.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

app.include_router(departments.router, prefix='/api')
app.include_router(device_categories.router, prefix='/api')
app.include_router(device_statuses.router, prefix='/api')
app.include_router(maintenance.router, prefix='/api')
app.include_router(repairs.router, prefix='/api')
app.include_router(replacement_parts.router, prefix='/api')
app.include_router(transfers.router, prefix='/api')
app.include_router(disposals.router, prefix='/api')


app.include_router(receptions.router, prefix='/api')

app.include_router(qr.router, prefix='/api')
app.include_router(system.router, prefix='/api')

app.include_router(workflow.router, prefix="/api")
