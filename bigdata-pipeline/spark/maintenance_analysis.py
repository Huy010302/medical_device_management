from pyspark.sql import functions as F

def maintenance_outputs(events):
    df = (
        events.filter(F.col("event_type").contains("MAINTENANCE"))
        .withColumn("event_date", F.to_date("timestamp"))
    )
    daily = (
        df.groupBy("event_date", "event_type")
        .agg(F.count("*").alias("event_count"))
        .orderBy("event_date", "event_type")
    )
    by_device = (
        df.groupBy("device_id")
        .agg(
            F.count("*").alias("maintenance_count"),
            F.min("timestamp").alias("first_maintenance"),
            F.max("timestamp").alias("last_maintenance"),
        )
        .orderBy(F.desc("maintenance_count"), "device_id")
    )
    return {"maintenance_daily": daily, "maintenance_by_device": by_device}
