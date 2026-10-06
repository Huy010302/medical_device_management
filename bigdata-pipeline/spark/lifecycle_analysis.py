from pyspark.sql import functions as F

def lifecycle_outputs(events):
    clean = events.withColumn("event_date", F.to_date("timestamp"))

    event_summary = (
        clean.groupBy("event_type")
        .agg(F.count("*").alias("event_count"))
        .orderBy(F.desc("event_count"), "event_type")
    )

    daily = (
        clean.groupBy("event_date", "event_type")
        .agg(F.count("*").alias("event_count"))
        .orderBy("event_date", "event_type")
    )

    activity = (
        clean.groupBy("device_id")
        .agg(
            F.count("*").alias("event_count"),
            F.min("timestamp").alias("first_event"),
            F.max("timestamp").alias("last_event"),
            F.countDistinct("event_type").alias("event_type_count"),
        )
        .orderBy(F.desc("event_count"), "device_id")
    )

    received = (
        clean.filter(F.col("event_type") == "DEVICE_RECEIVED")
        .groupBy("device_id")
        .agg(F.count("*").alias("received_count"), F.max("timestamp").alias("last_received"))
        .orderBy(F.desc("received_count"), "device_id")
    )

    transferred = (
        clean.filter(F.col("event_type") == "DEVICE_TRANSFERRED")
        .groupBy("device_id")
        .agg(F.count("*").alias("transfer_count"), F.max("timestamp").alias("last_transfer"))
        .orderBy(F.desc("transfer_count"), "device_id")
    )

    return {
        "lifecycle_event_summary": event_summary,
        "lifecycle_daily": daily,
        "device_activity": activity,
        "device_received": received,
        "device_transferred": transferred,
    }
