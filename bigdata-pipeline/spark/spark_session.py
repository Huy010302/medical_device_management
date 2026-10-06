from pathlib import Path
import os
from pyspark.sql import SparkSession

def build_spark(app_name="MedicalDeviceBigData"):
    # Make the active venv Python explicit on Windows workers.
    import sys
    os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
    os.environ.setdefault("PYSPARK_DRIVER_PYTHON", sys.executable)

    spark = (
        SparkSession.builder
        .master("local[4]")
        .appName(app_name)
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark
