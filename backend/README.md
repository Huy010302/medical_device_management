# MedDevice Backend — PostgreSQL / FastAPI

The canonical **local demo instructions and audit** are at `../README_DEMO.md` and `../AUDIT_REPORT.md`.

Run from this directory on Windows PowerShell after installing Docker Desktop and Python 3.11:

```powershell
docker compose up -d postgres
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# EDIT .env: set JWT_SECRET and ADMIN_PASSWORD; ensure port 5434 is free.
Get-Content .\sql\001_schema.sql -Raw | docker exec -i meddevice-postgres psql -v ON_ERROR_STOP=1 -U postgres -d meddevice
Get-Content .\sql\002_workflow_bridge.sql -Raw | docker exec -i meddevice-postgres psql -v ON_ERROR_STOP=1 -U postgres -d meddevice
python .\scripts\seed_admin.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints for demo: `/health`, `/api/auth/login`, `/api/records/devices`,
`/api/records/maintenance_records`, `/api/analytics/events/count`,
`/api/analytics/bigdata`, `/api/qr/{uuid}` and `/api/qr/{uuid}/internal`.

**Warning**: `/api/devices`, `/api/analytics/summary` and other legacy normalized
routes still point to *different* relational tables. The React demo explicitly
uses the new JSON compatibility routes, NOT those legacy routes. No existing
hospital data is migrated, merged or deleted. JSON fields and attachments are
not production-validated or suitable for sensitive patient data.
