"""Map devices onto the departments that currently exist in the `departments` table.

Sets department_id + current_location (= department name) on every device in
workflow_records (and on the relational `devices` table when the row exists).
Demo device types are matched to plausible departments by keyword
(e.g. Ultrasound -> Chan doan hinh anh / Kham benh, Autoclave -> KSNK);
device types with no keyword match fall back to a random clinical department.

  .\\.venv\\Scripts\\python.exe scripts\\map_devices_to_departments.py --dry-run
  .\\.venv\\Scripts\\python.exe scripts\\map_devices_to_departments.py
Options: --all (also real, non-DEMO devices without a department)
         --force (re-map devices that already have a department)
Afterwards run .\\CAP_NHAT_BIGDATA.ps1 so "Khoa co nhieu loi" gets department names.
"""
from __future__ import annotations
import argparse, random, sys, unicodedata, uuid
from collections import Counter
from pathlib import Path
from sqlalchemy import select, update
from sqlalchemy.orm.attributes import flag_modified

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.db.session import SessionLocal
from app.models.db_models import Department, Device
from app.models.workflow_models import WorkflowRecord

def norm(t: str) -> str:
    t = unicodedata.normalize("NFD", (t or "").replace("\u0111", "d").replace("\u0110", "D"))
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()

# device type -> keywords searched in the (accent-stripped, lower-case) department name / code
KEYWORDS = {
    "patient monitor": ("hoi suc", "cap cuu", "icu", "ngoai", "noi", "tim mach", "gay me"),
    "infusion pump": ("noi", "ngoai", "hoi suc", "cap cuu", "ung buou", "nhi", "truyen nhiem"),
    "syringe pump": ("hoi suc", "cap cuu", "gay me", "noi", "nhi", "ung buou"),
    "ventilator": ("hoi suc", "cap cuu", "gay me", "icu", "nhi"),
    "ecg machine": ("tim mach", "kham benh", "noi", "cap cuu"),
    "ultrasound system": ("cdha", "chan doan", "san", "kham benh", "tim mach"),
    "defibrillator": ("cap cuu", "hoi suc", "tim mach"),
    "electrosurgical unit": ("ngoai", "phau thuat", "san", "tai mui hong", "gay me", "mat", "rang"),
    "anesthesia machine": ("gay me", "phau thuat", "hoi suc"),
    "pulse oximeter": ("noi", "nhi", "cap cuu", "hoi suc", "kham benh", "truyen nhiem"),
    "x-ray system": ("cdha", "chan doan", "cap cuu"),
    "autoclave": ("ksnk", "khu khuan", "phau thuat", "tai mui hong", "rang"),
}
NON_CLINICAL = ("vttbyt", "duoc", "hanh chinh", "ke toan", "tai chinh", "to chuc", "giam doc", "cntt", "ke hoach")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--all", action="store_true"); ap.add_argument("--force", action="store_true"); ap.add_argument("--seed", type=int, default=20260930)
    a = ap.parse_args(); r = random.Random(a.seed)
    with SessionLocal() as db:
        deps = [d for d in db.scalars(select(Department)).all() if d.is_active is not False]
        if not deps: raise SystemExit("No active departments found.")
        by_key = [(d, norm(d.name) + " " + norm(d.code)) for d in deps]
        clinical = [d for d, k in by_key if not any(x in k for x in NON_CLINICAL)] or deps
        print(f"{len(deps)} active departments ({len(clinical)} treated as clinical).")
        devs = db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "devices")).all()
        counts, chosen, unmatched = Counter(), {}, Counter()
        for row in devs:
            p = row.payload
            if p.get("deleted_at"): continue
            if not (a.all or row.id.startswith("DEMO-DEV-")): continue
            if p.get("department_id") and not a.force: continue
            kws = KEYWORDS.get(norm(p.get("name", "")), ())
            pool = [d for d, k in by_key if any(w in k for w in kws)]
            if not pool: unmatched[p.get("name", "?")] += 1
            d = r.choice(pool or clinical)
            chosen[row.id] = d; counts[d.name] += 1
            if not a.dry_run:
                p["department_id"] = str(d.id); p["current_location"] = d.name
                flag_modified(row, "payload")
        print(f"\nDevices to map: {len(chosen):,}"); [print(f"  {n:<30}{c:>6}") for n, c in counts.most_common()]
        if unmatched: print("\nNo keyword match (random clinical department used):", dict(unmatched))
        if a.dry_run: print("\nDRY RUN - nothing written."); return
        db.commit()
        # relational table (only rows that exist there)
        for did, d in chosen.items():
            db.execute(update(Device).where(Device.id == did).values(department_id=d.id, current_location=d.name))
        db.commit()
        # keep demo transfer history consistent with the new department names
        names = [d.name for d in clinical]
        for row in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == "transfer_records", WorkflowRecord.id.like("DEMO-TRF-%"))).all():
            d = chosen.get(row.payload.get("device_id"))
            if not d: continue
            row.payload["to_location"] = d.name
            row.payload["from_location"] = r.choice([n for n in names if n != d.name] or names)
            flag_modified(row, "payload")
        db.commit()
    print("\nDONE. Refresh the browser; then run .\\CAP_NHAT_BIGDATA.ps1")
if __name__ == "__main__": main()
