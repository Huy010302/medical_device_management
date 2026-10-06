"""Export committed events and workflow snapshots without synthesizing records."""

import argparse
import json
import sys
from pathlib import Path

# Add backend root to Python import path
BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.workflow_models import DeviceEvent, WorkflowRecord
from app.models.db_models import Department


def write_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp = path.with_suffix(path.suffix + ".tmp")

    with tmp.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                    default=str
                )
                + "\n"
            )

    tmp.replace(path)


def main():

    parser = argparse.ArgumentParser(
        description="Export committed PostgreSQL records to JSONL"
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Output JSONL event file"
    )

    args = parser.parse_args()

    output = Path(args.output).resolve()

    with SessionLocal() as db:

        # Export device events
        events = (
            {
                "_id": e.id,
                "device_id": e.device_id,
                "event_type": e.event_type,
                "timestamp": e.timestamp.isoformat()
                if e.timestamp else None,
                "metadata": e.metadata_json,
            }
            for e in db.scalars(
                select(DeviceEvent)
                .order_by(
                    DeviceEvent.timestamp,
                    DeviceEvent.id
                )
            )
            .yield_per(1000)
        )

        write_jsonl(
            output,
            events
        )


        # Export workflow snapshots
        workflow_kinds = (
            "devices",
            "maintenance_records",
            "repair_records",
            "replacement_parts",
            "purchase_records",
            "reception_records",
        )


        for kind in workflow_kinds:

            records = (
                r.payload
                for r in db.scalars(
                    select(WorkflowRecord)
                    .where(
                        WorkflowRecord.kind == kind
                    )
                )
                .yield_per(1000)

                if (
                    kind != "devices"
                    or not r.payload.get("deleted_at")
                )
            )

            write_jsonl(
                output.parent / f"{kind}.jsonl",
                records
            )


        # Export departments
        departments = (
            {
                "id": str(r.id),
                "name": r.name
            }
            for r in db.scalars(
                select(Department)
            )
            .yield_per(1000)
        )


        write_jsonl(
            output.parent / "departments.jsonl",
            departments
        )


    print(
        "Exported committed database records to",
        output.parent
    )


if __name__ == "__main__":
    main()