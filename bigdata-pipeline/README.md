# Medical Device Big Data Pipeline (rebuilt)

This folder rebuilds the batch analytics pipeline used by the demo.

Flow:

PostgreSQL -> `backend/scripts/export_events.py` -> JSONL ->
Apache Spark -> CSV -> FastAPI `/analytics/bigdata` -> React dashboard.

## Windows setup

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Java 17 must be available:

```powershell
java -version
```

If your Windows Spark setup uses winutils:

```powershell
$env:HADOOP_HOME = "C:\hadoop"
$env:Path = "$env:HADOOP_HOME\bin;$env:Path"
```

## 1. Export committed DB events

```powershell
cd ..\backend
.\.venv\Scripts\Activate.ps1
python .\scripts\export_events.py
```

This creates:

`bigdata-pipeline/input/device_events.jsonl`

## 2. Run Spark

```powershell
cd ..\bigdata-pipeline
.\.venv\Scripts\Activate.ps1
python .\spark\run_demo_pipeline.py
```

The pipeline writes the nine CSV files expected by the backend into:

`dashboard/data/generated`

## Expected outputs

- lifecycle_event_summary.csv
- lifecycle_daily.csv
- device_activity.csv
- device_received.csv
- device_transferred.csv
- maintenance_daily.csv
- maintenance_by_device.csv
- repair_daily.csv
- repair_by_device.csv

The rebuilt pipeline is designed to handle the planned ~1,000 devices and
~500,000 events without collecting the raw event dataset into Python memory.
