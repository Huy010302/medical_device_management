# Export committed PostgreSQL events and rebuild Spark analytics.
# Optional benchmark:
#   .\CAP_NHAT_BIGDATA.ps1 -Benchmark
#   .\CAP_NHAT_BIGDATA.ps1 -Benchmark -BenchmarkRuns 5

param(
    [switch]$Benchmark,
    [ValidateRange(1, 20)]
    [int]$BenchmarkRuns = 3
)

$ErrorActionPreference = 'Stop'

# Make Vietnamese text display correctly in modern PowerShell/Windows Terminal.
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$bigdata = Join-Path $root 'bigdata-pipeline'
$backendPython = Join-Path $backend '.venv\Scripts\python.exe'
$bigdataPython = Join-Path $bigdata '.venv\Scripts\python.exe'
$eventFile = Join-Path $bigdata 'input\device_events.jsonl'

# >>> FIX_ALL_BIGDATA_V2 >>>
# Auto-generated Spark runtime settings.
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:HADOOP_HOME = "C:\hadoop"
$env:Path = "$env:JAVA_HOME\bin;$env:HADOOP_HOME\bin;$env:Path"
$env:PYSPARK_PYTHON = $bigdataPython
$env:PYSPARK_DRIVER_PYTHON = $bigdataPython
$env:PYSPARK_SUBMIT_ARGS = "--driver-memory 10g --conf spark.sql.inMemoryColumnarStorage.batchSize=1000 --conf spark.sql.shuffle.partitions=64 --conf spark.default.parallelism=64 pyspark-shell"
$sparkTmp = Join-Path $bigdata ".spark-tmp"
New-Item -ItemType Directory -Path $sparkTmp -Force | Out-Null
$env:SPARK_LOCAL_DIRS = $sparkTmp
# <<< FIX_ALL_BIGDATA_V2 <<<

if (-not (Test-Path $backendPython)) {
    throw "Backend Python not found: $backendPython"
}
if (-not (Test-Path $bigdataPython)) {
    throw "Big Data Python not found: $bigdataPython. Create bigdata-pipeline\.venv and install requirements.txt first."
}

if (-not $env:HADOOP_HOME -and (Test-Path 'C:\hadoop')) {
    $env:HADOOP_HOME = 'C:\hadoop'
    $env:Path = "$env:HADOOP_HOME\bin;$env:Path"
}

Write-Host '[1/2] Exporting committed PostgreSQL events to JSONL...' -ForegroundColor Cyan
Push-Location $backend
try {
    & $backendPython '.\scripts\export_events.py' --output $eventFile
    if ($LASTEXITCODE -ne 0) { throw 'Event export failed.' }
}
finally {
    Pop-Location
}

Write-Host '[2/2] Running Apache Spark analytics...' -ForegroundColor Cyan
Push-Location $bigdata
try {
    & $bigdataPython '.\spark\run_demo_pipeline.py'
    if ($LASTEXITCODE -ne 0) { throw 'Spark analytics pipeline failed.' }

    if ($Benchmark) {
        Write-Host "Running Spark benchmark v2: warm-up + $BenchmarkRuns repetitions per size..." -ForegroundColor Cyan
        & $bigdataPython '.\spark\benchmark_spark.py' --repetitions $BenchmarkRuns
        if ($LASTEXITCODE -ne 0) { throw 'Spark benchmark failed.' }
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'BIG DATA UPDATE COMPLETE.' -ForegroundColor Green
Write-Host 'Open http://127.0.0.1:5173 and choose "Phân tích Big Data".' -ForegroundColor Green
