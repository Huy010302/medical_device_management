"""Seed demo maintenance / repair / parts / purchase / transfer records + varied device statuses
for the DEMO-DEV-* devices created by seed_big_demo.py.

Run:  .venv\\Scripts\\python.exe scripts\\seed_workflow_demo.py --reset
Then: .\\CAP_NHAT_BIGDATA.ps1   (so Spark builds risk / cost / failure CSVs)
Only touches records whose id starts with DEMO-; real hospital data is never modified.
"""
from __future__ import annotations
import argparse, random, sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import delete, insert, select
from sqlalchemy.orm.attributes import flag_modified

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.db.session import SessionLocal
from app.models.workflow_models import WorkflowRecord

KINDS = ("maintenance_records", "repair_records", "replacement_parts", "purchase_records", "transfer_records")
PRICE = {"Patient Monitor": (60e6, 180e6), "Infusion Pump": (20e6, 60e6), "Syringe Pump": (15e6, 45e6), "Ventilator": (400e6, 1200e6),
         "ECG Machine": (40e6, 150e6), "Ultrasound System": (500e6, 2000e6), "Defibrillator": (120e6, 400e6), "Electrosurgical Unit": (80e6, 300e6),
         "Anesthesia Machine": (600e6, 1800e6), "Pulse Oximeter": (5e6, 25e6), "X-Ray System": (900e6, 3500e6), "Autoclave": (150e6, 600e6)}
VENDORS = ("Cong ty TNHH Thiet bi Y te Viet Nhat", "Cong ty CP Y te Mien Trung", "Cong ty Meditech", "Cong ty TNHH Hoang Long Medical", "Cong ty CP Thiet bi Y te Da Nang")
TECH = ("Nguyen Van An", "Tran Minh Duc", "Le Thi Hoa", "Pham Quoc Bao", "Vo Thanh Long")
FAULTS = {"electrical": ("Loi nguon, khong khoi dong", "Chap chon man hinh", "Hu day cap noi"),
          "sensor": ("Cam bien do sai lech", "Mat tin hieu cam bien", "Can hieu chuan lai cam bien"),
          "mechanical": ("Ket co cau co khi", "Ro ri ong dan", "Mon bo phan chuyen dong"),
          "software": ("Treo phan mem", "Loi phan mem dieu khien", "Mat ket noi mang HIS")}
PARTS = ("Pin", "Cam bien SpO2", "Cap ket noi", "Bo nguon", "Man hinh", "Van khi", "Bo mach chinh", "Quat tan nhiet")
LOC = ("ICU", "Emergency", "Operating Room", "Cardiology", "Radiology", "Pediatrics", "Internal Medicine", "Outpatient", "Laboratory", "Recovery")
# (status, weight) - what the device list will show
STATUS_MIX = (("operating", 78), ("maintenance", 6), ("maintenance_pending", 5), ("repairing", 4), ("needs_repair", 3), ("awaiting_parts", 2), ("irreparable", 1), ("disposed", 1))

def iso(d): return d.isoformat()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--seed", type=int, default=20260930); ap.add_argument("--reset", action="store_true")
    a = ap.parse_args(); r = random.Random(a.seed); today = date.today(); now = datetime.now(timezone.utc).isoformat()
    with SessionLocal() as db:
        devices = db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "devices", WorkflowRecord.id.like("DEMO-DEV-%"))).all()
        if not devices: raise SystemExit("No DEMO-DEV-* devices found. Run seed_big_demo.py first.")
        if a.reset:
            for k in KINDS: db.execute(delete(WorkflowRecord).where(WorkflowRecord.kind == k, WorkflowRecord.id.like("DEMO-%")))
            db.commit()
        rows = {k: [] for k in KINDS}; n = dict(m=0, rp=0, pt=0, pu=0, tr=0)
        lemons = set(r.sample([d.id for d in devices], k=max(1, len(devices) // 12)))  # ~8% devices with many recent repairs -> HIGH risk
        for dev in devices:
            p = dev.payload; did = dev.id; name = p.get("name", "Patient Monitor"); lo, hi = PRICE.get(name, (20e6, 100e6))
            inst = date.fromisoformat(p.get("installation_date") or (today - timedelta(days=900)).isoformat())
            price = round(r.uniform(lo, hi), -3)
            n["pu"] += 1; vendor = r.choice(VENDORS)
            rows["purchase_records"].append(dict(id=f"DEMO-PUR-{n['pu']:06d}", device_id=did, device_ids=[did], purchase_status="completed", contract_number=f"HD-{inst.year}/{n['pu']:04d}",
                contract_date=iso(inst - timedelta(days=30)), vendor_name=vendor, vendor_contact="", unit_price=price, quantity=1, total_value=price, currency="VND",
                payment_terms="Chuyen khoan", delivery_date=iso(inst), warranty_months=r.choice((12, 24, 36)), attachments=[], notes="Synthetic demo", created_at=now))
            for _ in range(r.choice((1, 2, 2, 3, 4))):  # maintenance
                n["m"] += 1; sched = today - timedelta(days=r.randint(5, 900)); res = r.choices(("completed", "incomplete", "needs_repair"), weights=(85, 10, 5))[0]
                rows["maintenance_records"].append(dict(id=f"DEMO-MNT-{n['m']:06d}", device_id=did, maintenance_type=r.choice(("preventive", "preventive", "corrective", "calibration")),
                    scheduled_date=iso(sched), actual_date=iso(sched + timedelta(days=r.randint(0, 3))) if res == "completed" else "", performed_by=r.choice(TECH), service_company="",
                    description="Bao tri dinh ky theo ke hoach", result=res, cost=round(r.uniform(3e5, 8e6), -3), next_maintenance_date=iso(sched + timedelta(days=180)), attachments=[], created_at=now))
            k = r.randint(4, 8) if did in lemons else r.choice((0, 0, 1, 1, 2))
            for _ in range(k):  # repairs
                n["rp"] += 1; cat = r.choice(list(FAULTS)); rep = today - timedelta(days=r.randint(3, 360 if did in lemons else 1000)); dur = r.randint(1, 25 if did in lemons else 12)
                status = r.choices(("completed", "in_progress", "awaiting_parts", "reported", "irreparable"), weights=(80, 8, 5, 5, 2))[0]
                cost = round(r.uniform(5e5, 25e6), -3); rid = f"DEMO-REP-{n['rp']:06d}"
                rows["repair_records"].append(dict(id=rid, device_id=did, report_date=iso(rep), reported_by=r.choice(TECH), fault_description=r.choice(FAULTS[cat]), fault_category=cat,
                    repair_start_date=iso(rep + timedelta(days=1)), repair_end_date=iso(rep + timedelta(days=dur)) if status in ("completed", "irreparable") else "", repair_company=r.choice(VENDORS),
                    technician=r.choice(TECH), repair_description="Khac phuc su co", parts_replaced=[], total_cost=cost, repair_status=status, warranty_claim=r.random() < 0.15, attachments=[], created_at=now))
                if r.random() < 0.5:
                    n["pt"] += 1; q = r.randint(1, 3)
                    rows["replacement_parts"].append(dict(id=f"DEMO-PRT-{n['pt']:06d}", device_id=did, repair_record_id=rid, replacement_date=iso(rep + timedelta(days=dur)), part_name=r.choice(PARTS),
                        part_code=f"PT-{r.randint(1000, 9999)}", quantity=q, unit_price=round(r.uniform(2e5, 6e6), -3), vendor=r.choice(VENDORS), reason="Thay the trong sua chua", performed_by=r.choice(TECH), part_status="installed", attachments=[], created_at=now))
            if r.random() < 0.25:  # transfers
                n["tr"] += 1; frm = p.get("current_location", r.choice(LOC)); to = r.choice([x for x in LOC if x != frm])
                rows["transfer_records"].append(dict(id=f"DEMO-TRF-{n['tr']:06d}", device_id=did, transfer_date=iso(today - timedelta(days=r.randint(1, 500))), from_location=to, to_location=frm, reason="Dieu chuyen theo nhu cau khoa", approved_by="Ban Giam doc", decision_number="", attachments=[], created_at=now))
            st = r.choices([s for s, _ in STATUS_MIX], weights=[w for _, w in STATUS_MIX])[0]
            if did in lemons and r.random() < 0.6: st = r.choice(("repairing", "needs_repair", "awaiting_parts", "maintenance_pending"))
            if st != p.get("current_status"): p["current_status"] = st; flag_modified(dev, "payload")
        db.commit()
        for k in KINDS:
            data = [dict(kind=k, id=x["id"], payload=x) for x in rows[k]]
            for i in range(0, len(data), 2000): db.execute(insert(WorkflowRecord), data[i:i + 2000]); db.commit()
            print(f"  {k}: {len(data):,}")
    print("DONE. Next: run .\\CAP_NHAT_BIGDATA.ps1 then refresh the browser.")
if __name__ == "__main__": main()
