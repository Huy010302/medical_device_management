from datetime import datetime, timezone
import csv
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import current_profile
from app.db.session import get_db
from app.models.workflow_models import DeviceEvent


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    current=Depends(current_profile),
):
    # One database aggregate over the same active-device predicate as /api/devices.
    # Keep the KPI query independent from chart distributions so a chart error
    # cannot blank every dashboard card.
    statuses = (
        "tendering", "approved", "purchased", "received", "operating",
        "maintenance", "maintenance_pending", "needs_repair", "repairing",
        "awaiting_parts", "irreparable", "disposed",
    )
    active = "kind = 'devices' AND COALESCE(payload->>'deleted_at', '') = ''"
    counts = ",\n".join(
        f"COUNT(*) FILTER (WHERE {active} AND payload->>'current_status' = '{status}') AS {status}"
        for status in statuses
    )
    row = db.execute(text(f"""
        SELECT COUNT(*) FILTER (WHERE {active}) AS total_devices,
               COUNT(*) FILTER (WHERE kind = 'maintenance_records') AS maintenance_count,
               COUNT(*) FILTER (WHERE kind = 'repair_records') AS repair_count,
               {counts}
        FROM workflow_records
    """)).mappings().one()
    status_summary = {key: int(row[key]) for key in statuses}
    status_summary["other"] = max(0, int(row["total_devices"]) - sum(status_summary.values()))
    return {
        "total_devices": int(row["total_devices"]),
        "status_summary": status_summary,
        "maintenance_count": int(row["maintenance_count"]),
        "repair_count": int(row["repair_count"]),
    }


@router.get("/category-summary")
def category_summary(db: Session = Depends(get_db), current=Depends(current_profile)):
    rows = db.execute(text("""
        SELECT COALESCE(NULLIF(w.payload->>'category', ''), c.name, 'Khác') AS category,
               COUNT(*) AS device_count
        FROM workflow_records AS w
        LEFT JOIN device_categories AS c ON c.id::text = w.payload->>'category_id'
        WHERE w.kind = 'devices' AND COALESCE(w.payload->>'deleted_at', '') = ''
        GROUP BY 1 ORDER BY device_count DESC, category
    """)).all()
    return {category: count for category, count in rows}


@router.get("/bigdata")
def bigdata_results(
    current=Depends(current_profile),
):
    """Publish Spark batch CSVs; never silently serve bundled sample data.

    Nine core datasets are required for backward compatibility. Newer analytical
    datasets are loaded when present, so upgrading the frontend does not break an
    existing demo before the next Spark run.
    """

    core_names = (
        "lifecycle_event_summary",
        "lifecycle_daily",
        "device_activity",
        "device_received",
        "device_transferred",
        "maintenance_daily",
        "maintenance_by_device",
        "repair_daily",
        "repair_by_device",
    )

    optional_names = (
        "event_monthly_summary",
        "cost_summary",
        "monthly_cost_analysis",
        "fault_category_summary",
        "maintenance_type_summary",
        "location_event_summary",
        "pipeline_run_summary",
        "spark_benchmark",
        "device_risk_score",
        "device_lifecycle_cost",
        "failure_categories",
        "failure_devices",
        "failure_departments",
        "maintenance_departments",
    )

    technical_names = (
        "pipeline_run_summary",
        "spark_benchmark",
        "device_risk_score",
        "device_lifecycle_cost",
        "failure_categories",
        "failure_devices",
        "failure_departments",
        "maintenance_departments",
    )

    root = Path(settings.analytics_dir).resolve()

    missing = [
        name for name in core_names
        if not (root / f"{name}.csv").is_file()
    ]

    if missing:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Run the Spark export before viewing analytics",
                "missing": missing,
            },
        )

    results = {}
    loaded_files = []

    for name in (*core_names, *optional_names):
        path = root / f"{name}.csv"
        if not path.is_file():
            continue
        with path.open(encoding="utf-8-sig", newline="") as f:
            results[name] = list(csv.DictReader(f))
        loaded_files.append(path)

    newest_mtime = max((p.stat().st_mtime for p in loaded_files), default=0)
    generated_at = (
        datetime.fromtimestamp(newest_mtime, tz=timezone.utc).isoformat()
        if newest_mtime else None
    )

    return {
        "source": "spark_csv",
        "datasets": results,
        "meta": {
            "dataset_count": len(results),
            "analytical_dataset_count": sum(
                1 for name in results if name not in technical_names
            ),
            "technical_dataset_count": sum(
                1 for name in technical_names if name in results
            ),
            "core_dataset_count": len(core_names),
            "extended_dataset_count": max(0, len(results) - len(core_names)),
            "generated_at": generated_at,
        },
    }


@router.get("/events/count")
def committed_event_count(
    db: Session = Depends(get_db),
    current=Depends(current_profile),
):
    return {
        "events": (
            db.scalar(
                select(func.count())
                .select_from(DeviceEvent)
            )
            or 0
        )
    }


@router.get("/events")
def list_events(
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    device_id: str | None = Query(
        default=None,
    ),
    event_type: str | None = Query(
        default=None,
    ),
    start_date: datetime | None = Query(
        default=None,
    ),
    end_date: datetime | None = Query(
        default=None,
    ),
    db: Session = Depends(get_db),
    current=Depends(current_profile),
):
    filters = []

    if device_id:
        filters.append(
            DeviceEvent.device_id == device_id
        )

    if event_type:
        filters.append(
            DeviceEvent.event_type == event_type
        )

    if start_date:
        filters.append(
            DeviceEvent.timestamp >= start_date
        )

    if end_date:
        filters.append(
            DeviceEvent.timestamp <= end_date
        )

    count_stmt = (
        select(func.count())
        .select_from(DeviceEvent)
    )

    data_stmt = select(DeviceEvent)

    if filters:
        count_stmt = count_stmt.where(*filters)
        data_stmt = data_stmt.where(*filters)

    total = db.scalar(count_stmt) or 0

    rows = db.scalars(
        data_stmt
        .order_by(DeviceEvent.timestamp.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    items = [
        {
            "id": row.id,
            "device_id": row.device_id,
            "event_type": row.event_type,
            "timestamp": row.timestamp.isoformat(),
            "metadata": row.metadata_json,
        }
        for row in rows
    ]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(items) < total,
        "items": items,
    }
