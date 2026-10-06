from pyspark.sql import functions as F

def repair_outputs(events):
    df = (
        events.filter(F.col("event_type").contains("REPAIR"))
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
            F.count("*").alias("repair_count"),
            F.min("timestamp").alias("first_repair"),
            F.max("timestamp").alias("last_repair"),
        )
        .orderBy(F.desc("repair_count"), "device_id")
    )
    return {"repair_daily": daily, "repair_by_device": by_device}
