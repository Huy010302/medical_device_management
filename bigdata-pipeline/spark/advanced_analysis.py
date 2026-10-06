from pyspark.sql import functions as F


def advanced_outputs(events):
    """Additional management analytics derived from flexible event metadata.

    Metadata is converted to JSON first so the expressions keep working whether Spark
    inferred it as a struct or a map. Missing fields simply become null.
    """
    enriched = (
        events
        .withColumn("event_month", F.date_format("timestamp", "yyyy-MM"))
        .withColumn("_metadata_json", F.to_json("metadata"))
        .withColumn("cost", F.get_json_object("_metadata_json", "$.cost").cast("double"))
        .withColumn("fault_category", F.get_json_object("_metadata_json", "$.fault_category"))
        .withColumn("maintenance_type", F.get_json_object("_metadata_json", "$.maintenance_type"))
        .withColumn("location", F.get_json_object("_metadata_json", "$.location"))
    )

    monthly_events = (
        enriched.groupBy("event_month", "event_type")
        .agg(F.count("*").alias("event_count"))
        .orderBy("event_month", "event_type")
    )

    cost_events = enriched.filter(
        F.col("event_type").isin("MAINTENANCE_COMPLETED", "REPAIR_COMPLETED")
    )

    cost_summary = (
        cost_events.groupBy("event_type")
        .agg(
            F.count("*").alias("event_count"),
            F.count("cost").alias("events_with_cost"),
            F.coalesce(F.sum("cost"), F.lit(0.0)).alias("total_cost"),
            F.coalesce(F.avg("cost"), F.lit(0.0)).alias("average_cost"),
            F.coalesce(F.max("cost"), F.lit(0.0)).alias("max_cost"),
        )
        .orderBy("event_type")
    )

    monthly_cost = (
        enriched.groupBy("event_month")
        .agg(
            F.sum(
                F.when(F.col("event_type") == "MAINTENANCE_COMPLETED", F.coalesce(F.col("cost"), F.lit(0.0)))
                .otherwise(F.lit(0.0))
            ).alias("maintenance_cost"),
            F.sum(
                F.when(F.col("event_type") == "REPAIR_COMPLETED", F.coalesce(F.col("cost"), F.lit(0.0)))
                .otherwise(F.lit(0.0))
            ).alias("repair_cost"),
        )
        .orderBy("event_month")
    )

    fault_summary = (
        enriched
        .filter((F.col("event_type") == "REPAIR_COMPLETED") & F.col("fault_category").isNotNull())
        .groupBy("fault_category")
        .agg(
            F.count("*").alias("repair_count"),
            F.coalesce(F.sum("cost"), F.lit(0.0)).alias("total_cost"),
            F.coalesce(F.avg("cost"), F.lit(0.0)).alias("average_cost"),
        )
        .orderBy(F.desc("repair_count"), "fault_category")
    )

    maintenance_type_summary = (
        enriched
        .filter((F.col("event_type") == "MAINTENANCE_COMPLETED") & F.col("maintenance_type").isNotNull())
        .groupBy("maintenance_type")
        .agg(
            F.count("*").alias("maintenance_count"),
            F.coalesce(F.sum("cost"), F.lit(0.0)).alias("total_cost"),
            F.coalesce(F.avg("cost"), F.lit(0.0)).alias("average_cost"),
        )
        .orderBy(F.desc("maintenance_count"), "maintenance_type")
    )

    location_summary = (
        enriched
        .filter(F.col("location").isNotNull() & (F.length(F.col("location")) > 0))
        .groupBy("location")
        .agg(F.count("*").alias("event_count"))
        .orderBy(F.desc("event_count"), "location")
    )

    return {
        "event_monthly_summary": monthly_events,
        "cost_summary": cost_summary,
        "monthly_cost_analysis": monthly_cost,
        "fault_category_summary": fault_summary,
        "maintenance_type_summary": maintenance_type_summary,
        "location_event_summary": location_summary,
    }
