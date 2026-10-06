"""Seed synthetic tendering, purchasing and reception data for DEMO devices.

Safe scope:
- Reads DEMO devices already stored in workflow_records (kind='devices').
- Writes DEMO-only records to both relational tables (when present) and workflow_records,
  so both FastAPI pages and the compatibility workflow store can display them.
- Does NOT delete or modify real/non-DEMO records.
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import MetaData, Table, delete, insert, select

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal
from app.models.workflow_models import WorkflowRecord

DEMO_DEVICE_PREFIX = "DEMO-DEV-"
TENDER_PREFIX = "DEMO-TENDER-"
PURCHASE_PREFIX = "DEMO-PURCHASE-"
RECEPTION_PREFIX = "DEMO-RECEPTION-"

VENDORS = (
    "Công ty Thiết bị Y tế Minh Tâm",
    "Công ty Kỹ thuật Y khoa An Phát",
    "Công ty Trang thiết bị Y tế Đông Á",
    "Công ty Giải pháp Y tế Hưng Thịnh",
    "Công ty Thiết bị Bệnh viện Việt Phúc",
)

PRICE_BY_NAME = {
    "Patient Monitor": 85_000_000,
    "Infusion Pump": 48_000_000,
    "Syringe Pump": 42_000_000,
    "Ventilator": 620_000_000,
    "ECG Machine": 125_000_000,
    "Ultrasound System": 1_250_000_000,
    "Defibrillator": 210_000_000,
    "Electrosurgical Unit": 180_000_000,
    "Anesthesia Machine": 1_450_000_000,
    "Pulse Oximeter": 12_000_000,
    "X-Ray System": 2_600_000_000,
    "Autoclave": 320_000_000,
}


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def table_if_exists(bind, name: str):
    md = MetaData()
    try:
        return Table(name, md, autoload_with=bind)
    except Exception:
        return None


def filter_row_for_table(table, row: dict) -> dict:
    cols = set(table.c.keys())
    return {k: v for k, v in row.items() if k in cols}


def delete_demo_rows(db, table, prefix: str):
    if table is not None and "id" in table.c:
        db.execute(delete(table).where(table.c.id.like(f"{prefix}%")))


def insert_rows(db, table, rows: list[dict]):
    if table is None or not rows:
        return 0
    filtered = [filter_row_for_table(table, r) for r in rows]
    db.execute(insert(table), filtered)
    return len(filtered)


def workflow_rows(kind: str, rows: list[dict]):
    return [
        {
            "kind": kind,
            "id": str(row["id"]),
            "payload": row["payload"],
        }
        for row in rows
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group-size", type=int, default=20,
                        help="Number of DEMO devices per tender/purchase package (default: 20).")
    parser.add_argument("--seed", type=int, default=20260928)
    parser.add_argument("--reset-demo", action="store_true",
                        help="Delete only DEMO procurement/reception records before inserting.")
    args = parser.parse_args()

    if args.group_size < 1:
        raise SystemExit("--group-size must be >= 1")

    rng = random.Random(args.seed)
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        bind = db.get_bind()

        tender_table = table_if_exists(bind, "tendering_records")
        purchase_table = table_if_exists(bind, "purchase_records")
        reception_table = table_if_exists(bind, "reception_records")

        device_records = db.scalars(
            select(WorkflowRecord)
            .where(
                WorkflowRecord.kind == "devices",
                WorkflowRecord.id.like(f"{DEMO_DEVICE_PREFIX}%"),
            )
            .order_by(WorkflowRecord.id)
        ).all()

        if not device_records:
            raise SystemExit(
                "No DEMO devices found in workflow_records. "
                "Run seed_big_demo.py first."
            )

        devices = []
        for rec in device_records:
            p = dict(rec.payload or {})
            p["id"] = rec.id
            devices.append(p)

        print(f"Found {len(devices):,} DEMO devices.")

        if args.reset_demo:
            print("Removing previous DEMO procurement/reception records only...")
            delete_demo_rows(db, reception_table, RECEPTION_PREFIX)
            delete_demo_rows(db, purchase_table, PURCHASE_PREFIX)
            delete_demo_rows(db, tender_table, TENDER_PREFIX)

            db.execute(
                delete(WorkflowRecord).where(
                    WorkflowRecord.kind == "reception_records",
                    WorkflowRecord.id.like(f"{RECEPTION_PREFIX}%"),
                )
            )
            db.execute(
                delete(WorkflowRecord).where(
                    WorkflowRecord.kind == "purchase_records",
                    WorkflowRecord.id.like(f"{PURCHASE_PREFIX}%"),
                )
            )
            db.execute(
                delete(WorkflowRecord).where(
                    WorkflowRecord.kind == "tendering_records",
                    WorkflowRecord.id.like(f"{TENDER_PREFIX}%"),
                )
            )
            db.commit()

        tender_rel_rows = []
        purchase_rel_rows = []
        reception_rel_rows = []

        tender_wf_rows = []
        purchase_wf_rows = []
        reception_wf_rows = []

        groups = list(chunked(devices, args.group_size))

        for gidx, group in enumerate(groups, start=1):
            tender_id = f"{TENDER_PREFIX}{gidx:03d}"
            purchase_id = f"{PURCHASE_PREFIX}{gidx:03d}"

            install_dates = [
                parse_iso_date(d.get("installation_date"))
                for d in group
            ]
            install_dates = [d for d in install_dates if d]

            # Keep procurement chronology before installation when installation_date exists.
            if install_dates:
                base_install = min(install_dates)
            else:
                base_install = date.today() - timedelta(days=365)

            tender_date = base_install - timedelta(days=150)
            decision_date = base_install - timedelta(days=120)
            contract_date = base_install - timedelta(days=100)
            delivery_date = base_install - timedelta(days=35)

            vendor = VENDORS[(gidx - 1) % len(VENDORS)]
            device_ids = [str(d["id"]) for d in group]

            tender_items = []
            purchase_items = []
            estimated_total = 0
            winning_total = 0

            for didx, d in enumerate(group, start=1):
                base_price = PRICE_BY_NAME.get(str(d.get("name")), 100_000_000)
                # Deterministic, small variation while keeping believable demo values.
                factor = 0.92 + rng.random() * 0.16
                estimated_unit = int(round(base_price * factor / 100_000) * 100_000)
                winning_unit = int(round(estimated_unit * (0.94 + rng.random() * 0.04) / 100_000) * 100_000)
                estimated_total += estimated_unit
                winning_total += winning_unit

                tender_items.append({
                    "id": f"{tender_id}-ITEM-{didx:03d}",
                    "device_ids": [d["id"]],
                    "device_codes": [d.get("device_code", "")],
                    "name": d.get("name", "Thiết bị y tế"),
                    "category": d.get("category", ""),
                    "manufacturer": d.get("manufacturer", ""),
                    "model": d.get("model", ""),
                    "origin_country": d.get("origin_country", ""),
                    "unit": d.get("unit", "unit"),
                    "quantity": 1,
                    "estimated_unit_value": estimated_unit,
                    "notes": "Dữ liệu giả lập phục vụ demo môn Cơ sở dữ liệu nâng cao.",
                })

                purchase_items.append({
                    "id": f"{purchase_id}-ITEM-{didx:03d}",
                    "device_ids": [d["id"]],
                    "device_codes": [d.get("device_code", "")],
                    "name": d.get("name", "Thiết bị y tế"),
                    "category": d.get("category", ""),
                    "manufacturer": d.get("manufacturer", ""),
                    "model": d.get("model", ""),
                    "unit": d.get("unit", "unit"),
                    "quantity": 1,
                    "unit_price": winning_unit,
                })

            tender_payload = {
                "id": tender_id,
                "device_id": device_ids[0],
                "device_ids": device_ids,
                "tender_items": tender_items,
                "tender_code": f"GT-DEMO-{tender_date.year}-{gidx:03d}",
                "tender_name": f"Gói thầu trang thiết bị y tế số {gidx:03d}",
                "estimated_value": estimated_total,
                "tender_date": tender_date.isoformat(),
                "winning_vendor": vendor,
                "winning_bid_value": winning_total,
                "tender_status": "awarded",
                "decision_number": f"QĐ-DEMO-{gidx:03d}/{decision_date.year}",
                "decision_date": decision_date.isoformat(),
                "attachments": [],
                "notes": "Dữ liệu giả lập phục vụ demo; không phải hồ sơ mua sắm thực tế.",
                "created_by": "demo-seed",
                "created_at": datetime.combine(
                    tender_date, datetime.min.time(), tzinfo=timezone.utc
                ).isoformat(),
            }

            purchase_payload = {
                "id": purchase_id,
                "device_id": device_ids[0],
                "device_ids": device_ids,
                "purchase_items": purchase_items,
                "tendering_record_id": tender_id,
                "purchase_status": "completed",
                "contract_number": f"HĐ-DEMO-{gidx:03d}/{contract_date.year}",
                "contract_date": contract_date.isoformat(),
                "vendor_name": vendor,
                "vendor_contact": "Dữ liệu demo",
                "unit_price": int(winning_total / max(1, len(group))),
                "quantity": len(group),
                "total_value": winning_total,
                "currency": "VND",
                "payment_terms": "Thanh toán theo điều khoản hợp đồng (dữ liệu demo)",
                "delivery_date": delivery_date.isoformat(),
                "warranty_months": 24,
                "attachments": [],
                "notes": f"Tự sinh từ {tender_payload['tender_code']} phục vụ demo.",
                "created_by": "demo-seed",
                "created_at": datetime.combine(
                    contract_date, datetime.min.time(), tzinfo=timezone.utc
                ).isoformat(),
            }

            tender_rel_rows.append({
                **tender_payload,
                "tender_date": tender_date,
                "decision_date": decision_date,
                "created_at": datetime.combine(
                    tender_date, datetime.min.time(), tzinfo=timezone.utc
                ),
            })

            purchase_rel_rows.append({
                **purchase_payload,
                "contract_date": contract_date,
                "delivery_date": delivery_date,
                "created_at": datetime.combine(
                    contract_date, datetime.min.time(), tzinfo=timezone.utc
                ),
            })

            tender_wf_rows.append({
                "id": tender_id,
                "payload": tender_payload,
            })
            purchase_wf_rows.append({
                "id": purchase_id,
                "payload": purchase_payload,
            })

            # One reception record per device so the lifecycle profile is also populated.
            for d in group:
                did = str(d["id"])
                suffix = did.replace(DEMO_DEVICE_PREFIX, "")
                reception_id = f"{RECEPTION_PREFIX}{suffix}"

                install_date = parse_iso_date(d.get("installation_date")) or (delivery_date + timedelta(days=15))
                reception_date = min(install_date, delivery_date + timedelta(days=15))
                commissioning_date = max(reception_date, install_date)
                warranty_start = commissioning_date
                warranty_end = warranty_start + timedelta(days=730)

                reception_payload = {
                    "id": reception_id,
                    "device_id": did,
                    "purchase_record_id": purchase_id,
                    "reception_date": reception_date.isoformat(),
                    "reception_committee": [
                        {"name": "Hội đồng nghiệm thu demo", "title": "Đại diện bệnh viện"}
                    ],
                    "serial_number": d.get("serial_number", f"SN-{suffix}"),
                    "asset_code": d.get("asset_code", f"ASSET-{suffix}"),
                    "installation_date": install_date.isoformat(),
                    "commissioning_date": commissioning_date.isoformat(),
                    "warranty_start": warranty_start.isoformat(),
                    "warranty_end": warranty_end.isoformat(),
                    "initial_location": d.get("current_location", ""),
                    "acceptance_status": "passed",
                    "attachments": [],
                    "notes": "Dữ liệu tiếp nhận giả lập phục vụ demo.",
                    "created_by": "demo-seed",
                    "created_at": datetime.combine(
                        reception_date, datetime.min.time(), tzinfo=timezone.utc
                    ).isoformat(),
                }

                reception_rel_rows.append({
                    **reception_payload,
                    "reception_date": reception_date,
                    "installation_date": install_date,
                    "commissioning_date": commissioning_date,
                    "warranty_start": warranty_start,
                    "warranty_end": warranty_end,
                    "created_at": datetime.combine(
                        reception_date, datetime.min.time(), tzinfo=timezone.utc
                    ),
                })
                reception_wf_rows.append({
                    "id": reception_id,
                    "payload": reception_payload,
                })

        # Remove exactly the IDs this run will recreate, even without --reset-demo.
        # This makes the script idempotent for DEMO data.
        for kind, rows in (
            ("reception_records", reception_wf_rows),
            ("purchase_records", purchase_wf_rows),
            ("tendering_records", tender_wf_rows),
        ):
            ids = [r["id"] for r in rows]
            if ids:
                db.execute(
                    delete(WorkflowRecord).where(
                        WorkflowRecord.kind == kind,
                        WorkflowRecord.id.in_(ids),
                    )
                )

        if reception_table is not None:
            ids = [r["id"] for r in reception_rel_rows]
            if ids:
                db.execute(delete(reception_table).where(reception_table.c.id.in_(ids)))
        if purchase_table is not None:
            ids = [r["id"] for r in purchase_rel_rows]
            if ids:
                db.execute(delete(purchase_table).where(purchase_table.c.id.in_(ids)))
        if tender_table is not None:
            ids = [r["id"] for r in tender_rel_rows]
            if ids:
                db.execute(delete(tender_table).where(tender_table.c.id.in_(ids)))

        db.commit()

        print(f"Seeding {len(tender_rel_rows):,} tender packages...")
        tender_rel_count = insert_rows(db, tender_table, tender_rel_rows)

        print(f"Seeding {len(purchase_rel_rows):,} purchase records...")
        purchase_rel_count = insert_rows(db, purchase_table, purchase_rel_rows)

        print(f"Seeding {len(reception_rel_rows):,} reception records...")
        reception_rel_count = insert_rows(db, reception_table, reception_rel_rows)

        db.execute(insert(WorkflowRecord), workflow_rows("tendering_records", tender_wf_rows))
        db.execute(insert(WorkflowRecord), workflow_rows("purchase_records", purchase_wf_rows))
        db.execute(insert(WorkflowRecord), workflow_rows("reception_records", reception_wf_rows))
        db.commit()

        wf_tender = db.scalar(
            select(__import__("sqlalchemy").func.count())
            .select_from(WorkflowRecord)
            .where(WorkflowRecord.kind == "tendering_records")
        ) or 0
        wf_purchase = db.scalar(
            select(__import__("sqlalchemy").func.count())
            .select_from(WorkflowRecord)
            .where(WorkflowRecord.kind == "purchase_records")
        ) or 0
        wf_reception = db.scalar(
            select(__import__("sqlalchemy").func.count())
            .select_from(WorkflowRecord)
            .where(WorkflowRecord.kind == "reception_records")
        ) or 0

    print("\nDONE")
    print(f"DEMO tender packages      : {len(tender_wf_rows):,}")
    print(f"DEMO purchase records     : {len(purchase_wf_rows):,}")
    print(f"DEMO reception records    : {len(reception_wf_rows):,}")
    print(f"Relational tender inserted: {tender_rel_count:,}")
    print(f"Relational purchase insert: {purchase_rel_count:,}")
    print(f"Relational reception insert: {reception_rel_count:,}")
    print(f"Frontend tender records   : {wf_tender:,}")
    print(f"Frontend purchase records : {wf_purchase:,}")
    print(f"Frontend reception records: {wf_reception:,}")


if __name__ == "__main__":
    main()
