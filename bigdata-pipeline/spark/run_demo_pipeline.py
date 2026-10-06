from pyspark import StorageLevel
from datetime import datetime, timezone
from pathlib import Path
import csv
import sys
import time

from pyspark.sql import functions as F

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INPUT = ROOT / "input" / "device_events.jsonl"
OUTPUT = ROOT / "dashboard" / "data" / "generated"

sys.path.insert(0, str(HERE))
from spark_session import build_spark
from bigdata_analysis import build_outputs
from export_dashboard_data import export_all
from hospital_insights import hospital_outputs


def write_pipeline_summary(output_file: Path, row: dict):
    output_file.parent.mkdir(parents=True, exist_ok=True)
    tmp = output_file.with_suffix(output_file.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(row.keys()))
        writer.writeheader()
        writer.writerow(row)
    tmp.replace(output_file)


def main():
    if not INPUT.is_file():
        raise SystemExit(
            f"Missing input: {INPUT}\n"
            "Run backend/scripts/export_events.py first."
        )

    started = time.perf_counter()
    spark = build_spark()
    try:
        # Read JSON normally because metadata intentionally contains mixed value types.
        if INPUT.stat().st_size == 0:
            from pyspark.sql.types import StructType, StructField, StringType, MapType
            raw = spark.createDataFrame([], StructType([StructField(n,MapType(StringType(),StringType()) if n=='metadata' else StringType()) for n in ('_id','device_id','event_type','timestamp','metadata')]))
        else:
            raw = spark.read.json(str(INPUT))
        events = (
            raw.select("_id", "device_id", "event_type", "timestamp", "metadata")
            .withColumn("timestamp", F.to_timestamp("timestamp"))
            .filter(
                F.col("device_id").isNotNull()
                & F.col("event_type").isNotNull()
                & F.col("timestamp").isNotNull()
            )
            .persist(StorageLevel.DISK_ONLY)
        )

        total = events.count()
        # Zero committed events is a valid newly installed hospital database.

        metrics = (
            events
            .withColumn("_metadata_json", F.to_json("metadata"))
            .withColumn(
                "_is_synthetic",
                F.lower(F.get_json_object("_metadata_json", "$.synthetic")) == F.lit("true"),
            )
            .agg(
                F.countDistinct("device_id").alias("distinct_devices"),
                F.countDistinct("event_type").alias("distinct_event_types"),
                F.min("timestamp").alias("first_event"),
                F.max("timestamp").alias("last_event"),
                F.sum(F.when(F.col("_is_synthetic"), F.lit(1)).otherwise(F.lit(0))).alias("synthetic_events"),
            )
            .first()
        )

        outputs = build_outputs(events)
        outputs.update(hospital_outputs(spark, ROOT / "input"))
        export_all(outputs, OUTPUT)

        elapsed = time.perf_counter() - started
        write_pipeline_summary(
            OUTPUT / "pipeline_run_summary.csv",
            {
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "total_events": total,
                "distinct_devices": metrics["distinct_devices"],
                "distinct_event_types": metrics["distinct_event_types"],
                "first_event": metrics["first_event"].isoformat() if metrics["first_event"] else "",
                "last_event": metrics["last_event"].isoformat() if metrics["last_event"] else "",
                "spark_version": spark.version,
                "processing_seconds": f"{elapsed:.3f}",
                "input_file_bytes": INPUT.stat().st_size,
                "analytical_datasets": len(outputs),
                "synthetic_events": int(metrics["synthetic_events"] or 0),
                "synthetic_ratio": f"{(int(metrics['synthetic_events'] or 0) / total):.6f}",
                "dataset_profile": (
                    "synthetic_demo"
                    if total > 0 and (int(metrics["synthetic_events"] or 0) / total) >= 0.90
                    else "mixed_or_real"
                ),
            },
        )

        print(
            f"SPARK PROCESSED {total:,} events; "
            f"{len(outputs)} analytical datasets; "
            f"elapsed {elapsed:.2f}s; CSV output: {OUTPUT}"
        )
        events.unpersist()
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
