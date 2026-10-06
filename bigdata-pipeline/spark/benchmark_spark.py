"""Benchmark representative Spark analytics at several event volumes.

Benchmark v2 methodology
------------------------
- Start one SparkSession.
- Read/validate the JSONL source once and cache the valid base dataset.
- Run one warm-up workload that is NOT reported.
- For every requested data size, execute the same analytical workload multiple times.
- Report the median processing time and throughput, plus min/max and individual trials.

This intentionally measures analytical scaling after Spark/JVM warm-up and after the
input source has been materialized. It is therefore complementary to the end-to-end
`processing_seconds` written by run_demo_pipeline.py, which measures the real batch
pipeline (read + aggregate + CSV export).

This is an academic/demo benchmark, not a production capacity certification.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import csv
from statistics import median
import sys
import time

from pyspark.sql import functions as F
from pyspark.storagelevel import StorageLevel

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INPUT = ROOT / "input" / "device_events.jsonl"
OUTPUT = ROOT / "dashboard" / "data" / "generated" / "spark_benchmark.csv"

sys.path.insert(0, str(HERE))
from spark_session import build_spark


BENCHMARK_VERSION = "2"
BENCHMARK_SCOPE = "analytics_only_cached_input"


def parse_sizes(value: str) -> list[int]:
    sizes: list[int] = []
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        n = int(item)
        if n <= 0:
            raise ValueError("Benchmark sizes must be positive integers.")
        sizes.append(n)
    return sorted(set(sizes))


def _representative_workload(events) -> None:
    """Execute the same set of analytics used for every benchmark trial."""
    events.groupBy("event_type").count().collect()

    (
        events.withColumn("event_date", F.to_date("timestamp"))
        .groupBy("event_date", "event_type")
        .count()
        .collect()
    )

    (
        events.groupBy("device_id")
        .count()
        .orderBy(F.desc("count"))
        .limit(20)
        .collect()
    )

    enriched = (
        events
        .withColumn("_metadata_json", F.to_json("metadata"))
        .withColumn("cost", F.get_json_object("_metadata_json", "$.cost").cast("double"))
    )

    (
        enriched.filter(
            F.col("event_type").isin(
                "MAINTENANCE_COMPLETED",
                "REPAIR_COMPLETED",
            )
        )
        .groupBy("event_type")
        .agg(
            F.sum("cost").alias("total_cost"),
            F.avg("cost").alias("average_cost"),
        )
        .collect()
    )


def benchmark_trial(base, size: int) -> dict[str, float | int]:
    """Run one measured repetition on a cached base dataset."""
    started = time.perf_counter()

    events = (
        base.limit(size)
        .persist(StorageLevel.MEMORY_AND_DISK)
    )

    actual = events.count()
    materialized_at = time.perf_counter()

    _representative_workload(events)

    finished = time.perf_counter()
    events.unpersist(blocking=True)

    materialize_seconds = materialized_at - started
    analytics_seconds = finished - materialized_at
    total_seconds = finished - started

    return {
        "actual_events": int(actual),
        "materialize_seconds": materialize_seconds,
        "analytics_seconds": analytics_seconds,
        "total_seconds": total_seconds,
    }


def summarize_trials(
    requested_size: int,
    trials: list[dict[str, float | int]],
    repetitions: int,
    warmup_events: int,
    spark_version: str,
) -> dict[str, str | int]:
    actual_values = [int(t["actual_events"]) for t in trials]
    actual = int(median(actual_values)) if actual_values else 0

    materialize_times = [float(t["materialize_seconds"]) for t in trials]
    analytics_times = [float(t["analytics_seconds"]) for t in trials]
    total_times = [float(t["total_seconds"]) for t in trials]

    median_materialize = median(materialize_times)
    median_analytics = median(analytics_times)
    median_total = median(total_times)
    throughput = actual / median_total if median_total > 0 else 0.0

    return {
        "benchmark_version": BENCHMARK_VERSION,
        "benchmark_scope": BENCHMARK_SCOPE,
        "requested_events": requested_size,
        "actual_events": actual,
        "repetitions": repetitions,
        "warmup_events": warmup_events,
        "median_materialize_seconds": f"{median_materialize:.4f}",
        "median_analytics_seconds": f"{median_analytics:.4f}",
        "median_total_seconds": f"{median_total:.4f}",
        "median_throughput_events_per_second": f"{throughput:.2f}",
        "min_total_seconds": f"{min(total_times):.4f}",
        "max_total_seconds": f"{max(total_times):.4f}",
        "trial_total_seconds": ";".join(f"{x:.4f}" for x in total_times),
        "spark_version": spark_version,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sizes",
        default="50000,100000,250000,500000",
        help="Comma-separated event counts (default: 50000,100000,250000,500000).",
    )
    parser.add_argument(
        "--repetitions",
        type=int,
        default=3,
        help="Measured repetitions per data size after warm-up (default: 3).",
    )
    parser.add_argument(
        "--warmup-events",
        type=int,
        default=10000,
        help="Warm-up workload size, excluded from results (default: 10000).",
    )
    args = parser.parse_args()

    if args.repetitions < 1:
        raise SystemExit("--repetitions must be >= 1")
    if args.warmup_events < 1:
        raise SystemExit("--warmup-events must be >= 1")

    if not INPUT.is_file():
        raise SystemExit(
            f"Missing input: {INPUT}\n"
            "Run backend/scripts/export_events.py first."
        )

    sizes = parse_sizes(args.sizes)
    spark = build_spark("MedicalDeviceBigDataBenchmarkV2")
    rows: list[dict[str, str | int]] = []

    base = None
    try:
        # Input parsing and Spark/JVM initialization are intentionally outside the
        # measured trials. They are already represented by the end-to-end pipeline
        # metric in pipeline_run_summary.csv.
        raw = spark.read.json(str(INPUT))
        base = (
            raw.select("device_id", "event_type", "timestamp", "metadata")
            .withColumn("timestamp", F.to_timestamp("timestamp"))
            .filter(
                F.col("device_id").isNotNull()
                & F.col("event_type").isNotNull()
                & F.col("timestamp").isNotNull()
            )
            .persist(StorageLevel.MEMORY_AND_DISK)
        )

        available = base.count()
        if available == 0:
            raise SystemExit("Input exists but contains no valid events.")

        effective_sizes = [min(size, available) for size in sizes]
        effective_warmup = min(args.warmup_events, available)

        print(
            f"BENCHMARK V2: cached {available:,} valid events; "
            f"warm-up={effective_warmup:,}; repetitions={args.repetitions}."
        )
        print(
            "Measured scope: subset materialization + representative analytics; "
            "Spark startup and initial JSON parsing are excluded."
        )

        # Warm-up once; do not record it.
        print(f"WARM-UP {effective_warmup:,} events (not reported)...")
        warmup = benchmark_trial(base, effective_warmup)
        print(
            f"  warm-up total={float(warmup['total_seconds']):.2f}s"
        )

        for requested_size, effective_size in zip(sizes, effective_sizes):
            print(
                f"BENCHMARK {requested_size:,} events "
                f"({args.repetitions} repetitions)..."
            )
            trials: list[dict[str, float | int]] = []

            for rep in range(1, args.repetitions + 1):
                trial = benchmark_trial(base, effective_size)
                trials.append(trial)
                print(
                    f"  run {rep}/{args.repetitions}: "
                    f"actual={int(trial['actual_events']):,}; "
                    f"total={float(trial['total_seconds']):.2f}s"
                )

            row = summarize_trials(
                requested_size=requested_size,
                trials=trials,
                repetitions=args.repetitions,
                warmup_events=effective_warmup,
                spark_version=spark.version,
            )
            rows.append(row)

            print(
                f"  median={float(row['median_total_seconds']):.2f}s; "
                f"throughput={float(row['median_throughput_events_per_second']):,.0f} events/s; "
                f"range={float(row['min_total_seconds']):.2f}-{float(row['max_total_seconds']):.2f}s"
            )

    finally:
        if base is not None:
            try:
                base.unpersist(blocking=True)
            except Exception:
                pass
        spark.stop()

    if not rows:
        raise SystemExit("No benchmark results were produced.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".csv.tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(OUTPUT)

    print(f"BENCHMARK RESULTS: {OUTPUT}")


if __name__ == "__main__":
    main()
