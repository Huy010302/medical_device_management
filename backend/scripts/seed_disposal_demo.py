"""Create demo disposal records (Thanh ly).

Every device already in status `disposed` without a disposal record gets one.
--extra N (default 25) additionally retires N of the oldest devices (status -> disposed)
so the Thanh ly page has a realistic amount of data. Only DEMO-DEV-* devices are touched.

  .\\.venv\\Scripts\\python.exe scripts\\seed_disposal_demo.py [--extra 25] [--reset]
"""
from __future__ import annotations
import argparse, random, sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import delete, select
from sqlalchemy.orm.attributes import flag_modified

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.db.session import SessionLocal
from app.models.workflow_models import WorkflowRecord

REASONS = ("Het khau hao, hu hong khong the sua chua", "Cong nghe lac hau, khong con linh kien thay the", "Chi phi sua chua vuot 50% gia tri may",
           "Khong dat tieu chuan an toan/hieu chuan", "Da ngung su dung, thay the bang thiet bi moi")
METHODS = ("auction", "auction", "destroy", "donate", "return_vendor")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--extra", type=int, default=25); ap.add_argument("--reset", action="store_true"); ap.add_argument("--seed", type=int, default=20260930)
    a = ap.parse_args(); r = random.Random(a.seed); today = date.today(); now = datetime.now(timezone.utc).isoformat()
    with SessionLocal() as db:
        if a.reset:
            db.execute(delete(WorkflowRecord).where(WorkflowRecord.kind == "disposal_records", WorkflowRecord.id.like("DEMO-DSP-%"))); db.commit()
        devices = {x.id: x for x in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "devices", WorkflowRecord.id.like("DEMO-DEV-%"))).all()}
        if not devices: raise SystemExit("No DEMO-DEV-* devices found.")
        price = {x.payload.get("device_id"): float(x.payload.get("total_value") or 0) for x in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "purchase_records", WorkflowRecord.id.like("DEMO-PUR-%"))).all()}
        done = {x.payload.get("device_id") for x in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "disposal_records")).all()}
        # retire the oldest still-active devices
        if a.extra > 0:
            active = sorted((d for d in devices.values() if d.payload.get("current_status") not in ("disposed",) and d.id not in done), key=lambda d: d.payload.get("installation_date") or "9999")
            for d in active[:a.extra]:
                d.payload["current_status"] = "disposed"; flag_modified(d, "payload")
            db.commit()
        n = 0
        for d in devices.values():
            if d.payload.get("current_status") != "disposed" or d.id in done: continue
            n += 1; inst = date.fromisoformat(d.payload.get("installation_date") or (today - timedelta(days=3000)).isoformat())
            years = max(0.0, (today - inst).days / 365.25); buy = price.get(d.id) or 50_000_000
            book = round(max(0.0, buy * (1 - min(years, 10) / 10)), -3)   # 10-year straight line
            method = r.choice(METHODS); recovered = 0 if method in ("destroy", "donate") else round(book * r.uniform(0.05, 0.4), -3)
            ddate = today - timedelta(days=r.randint(5, 700)); rid = f"DEMO-DSP-{n:05d}"
            payload = dict(id=rid, device_id=d.id, disposal_date=ddate.isoformat(), reason=r.choice(REASONS), disposal_method=method, disposal_committee=[],
                           book_value=book, disposal_value=recovered, decision_number=f"{r.randint(10, 999)}/QD-BV", decision_date=(ddate - timedelta(days=r.randint(3, 20))).isoformat(),
                           attachments=[], notes="Synthetic demo", created_at=now)
            db.add(WorkflowRecord(kind="disposal_records", id=rid, payload=payload))
        db.commit()
    print(f"Created {n} disposal records. Refresh the browser (Thanh ly page).")
if __name__ == "__main__": main()
