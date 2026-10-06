# Seed a large demo: 10,000 devices + 5,000,000 events (adjustable), then rebuild Spark analytics.
#   .\SEED_BIG_10K.ps1                       # 10k devices, 5M events, includes Spark
#   .\SEED_BIG_10K.ps1 -SkipSpark            # seed only; run .\CAP_NHAT_BIGDATA.ps1 later
#   .\SEED_BIG_10K.ps1 -Devices 3000 -Events 1000000
# Only DEMO-* records are replaced. Real hospital data is untouched.
param(
    [ValidateRange(100, 100000)][int]$Devices = 10000,
    [ValidateRange(10000, 20000000)][int]$Events = 5000000,
    [switch]$SkipSpark,
    [switch]$Yes
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$py = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { throw "Backend Python not found: $py" }

$gbDb = [math]::Round($Events * 570 / 1GB, 1); $gbJson = [math]::Round($Events * 430 / 1GB, 1)
Write-Host "Will REPLACE all DEMO data with $($Devices.ToString('N0')) devices and $($Events.ToString('N0')) events." -ForegroundColor Yellow
Write-Host "Needs about $gbDb GB in PostgreSQL (Docker volume) + $gbJson GB for the Spark JSONL export + WAL headroom." -ForegroundColor Yellow
if (-not $Yes -and (Read-Host 'Type YES to continue') -ne 'YES') { return }

$env:PYTHONPATH = $backend
Push-Location $backend
try {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    function Step($label, [scriptblock]$cmd) {
        Write-Host "`n== $label" -ForegroundColor Cyan
        & $cmd
        if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)." }
    }
    Step '[1/4] Devices + events'          { & $py .\scripts\seed_big_demo.py --devices $Devices --events $Events --batch-size 20000 --reset-demo }
    Step '[2/4] Maintenance/repair/parts/purchase/transfer + statuses' { & $py .\scripts\seed_workflow_demo.py --reset }
    Step '[3/4] Map devices to departments' { & $py .\scripts\map_devices_to_departments.py }
    Step '[4/4] Disposal records'          { & $py .\scripts\seed_disposal_demo.py --reset --extra ([int]($Devices * 0.025)) }
}
finally { Pop-Location }
Write-Host "`nSeed finished in $([math]::Round($sw.Elapsed.TotalMinutes,1)) min." -ForegroundColor Green

if ($SkipSpark) { Write-Host 'Skipped Spark. Run .\CAP_NHAT_BIGDATA.ps1 next, then Ctrl+F5 in the browser.' -ForegroundColor Green; return }
if (-not $env:SPARK_DRIVER_MEMORY) { $env:SPARK_DRIVER_MEMORY = '6g' }
& (Join-Path $root 'CAP_NHAT_BIGDATA.ps1')
