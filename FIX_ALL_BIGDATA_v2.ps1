param(
    [switch]$SkipBigDataRun,
    [switch]$SkipStartDemo
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# FIX_ALL_BIGDATA_v2.ps1
# One-shot repair for:
# - renamed folders
# - Java 17 / Hadoop env
# - PySpark environment
# - Spark OOM on ~5M events
# - CAP_NHAT_BIGDATA.ps1 run
# ------------------------------------------------------------

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptName = Split-Path -Leaf $MyInvocation.MyCommand.Path

$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$BigData  = Join-Path $Root "bigdata-pipeline"

$BackendPython = Join-Path $Backend ".venv\Scripts\python.exe"
$BigDataPython = Join-Path $BigData ".venv\Scripts\python.exe"

$CapScript     = Join-Path $Root "CAP_NHAT_BIGDATA.ps1"
$StartDemo     = Join-Path $Root "START_DEMO.ps1"
$RunDemo       = Join-Path $BigData "spark\run_demo_pipeline.py"
$SparkSession  = Join-Path $BigData "spark\spark_session.py"

function Step([string]$Text) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Backup-Once([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $bak = "$Path.before_fix_all_v2.bak"
    if (-not (Test-Path -LiteralPath $bak)) {
        Copy-Item -LiteralPath $Path -Destination $bak -Force
    }
}

function Write-Utf8([string]$Path, [string]$Text) {
    $enc = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Replace-Text([string]$Path, [hashtable]$Map) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }

    $old = [System.IO.File]::ReadAllText($Path)
    $new = $old

    foreach ($k in $Map.Keys) {
        $new = $new.Replace([string]$k, [string]$Map[$k])
    }

    if ($new -ne $old) {
        Backup-Once $Path
        Write-Utf8 $Path $new
        return $true
    }

    return $false
}

function Run-Native {
    param(
        [Parameter(Mandatory=$true)][string]$Exe,
        [string[]]$Args = @(),
        [string]$WorkingDirectory = ""
    )

    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    if ($WorkingDirectory) { Push-Location $WorkingDirectory }

    try {
        & $Exe @Args
        $code = $LASTEXITCODE
    }
    finally {
        if ($WorkingDirectory) { Pop-Location }
        $ErrorActionPreference = $oldEA
    }

    if ($null -eq $code) { $code = 0 }

    if ($code -ne 0) {
        throw "Command failed with exit code $code : $Exe $($Args -join ' ')"
    }
}

function Find-Java17Home {
    $candidates = @()

    if ($env:JAVA_HOME) {
        $candidates += $env:JAVA_HOME
    }

    $roots = @(
        "C:\Program Files\Microsoft",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java"
    )

    foreach ($base in $roots) {
        if (Test-Path -LiteralPath $base) {
            $dirs = Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match "jdk.*17|temurin.*17" } |
                Sort-Object Name -Descending

            foreach ($d in $dirs) {
                $candidates += $d.FullName
            }
        }
    }

    try {
        $javaExe = (Get-Command java.exe -ErrorAction Stop).Source
        if ($javaExe) {
            $candidates += (Split-Path (Split-Path $javaExe -Parent) -Parent)
        }
    } catch {}

    foreach ($c in ($candidates | Select-Object -Unique)) {
        if ($c -and (Test-Path -LiteralPath (Join-Path $c "bin\java.exe"))) {
            return $c
        }
    }

    return $null
}

Step "1/9 - Check project"

foreach ($dir in @($Backend, $Frontend, $BigData)) {
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
        throw "Missing project folder: $dir"
    }
}

if (-not (Test-Path -LiteralPath $BackendPython)) {
    throw "Backend Python missing: $BackendPython"
}

if (-not (Test-Path -LiteralPath $BigDataPython)) {
    throw "Big Data Python missing: $BigDataPython"
}

if (-not (Test-Path -LiteralPath $CapScript)) {
    throw "CAP_NHAT_BIGDATA.ps1 missing: $CapScript"
}

Write-Host "Root: $Root" -ForegroundColor Green

Step "2/9 - Fix old folder names"

$legacyMap = @{
    "backend-backup"          = "backend"
    "bigdata-pipeline-backup" = "bigdata-pipeline"
    "lifecycle-backup"        = "frontend"
}

$allowedExt = @(".ps1",".py",".json",".ts",".tsx",".md",".html",".txt")
$changed = 0

# IMPORTANT: ScriptName is captured BEFORE Where-Object.
# Do not call Split-Path on $MyInvocation inside the pipeline.
$files = Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue

foreach ($f in $files) {
    if ($f.Name -eq $ScriptName) { continue }
    if ($f.Extension -notin $allowedExt) { continue }
    if ($f.FullName -match "\\\.venv\\") { continue }
    if ($f.FullName -match "\\node_modules\\") { continue }
    if ($f.FullName -match "\\_AI_SHARE_STAGING\\") { continue }

    if (Replace-Text $f.FullName $legacyMap) {
        $changed++
        Write-Host "Patched: $($f.FullName)" -ForegroundColor DarkGray
    }
}

Write-Host "Patched legacy-path files: $changed" -ForegroundColor Green

Step "3/9 - Fix Java 17 + Hadoop"

$javaHome = Find-Java17Home

if (-not $javaHome) {
    Write-Host "Java 17 not found. Installing Microsoft OpenJDK 17..." -ForegroundColor Yellow

    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw "Java 17 is missing and winget is unavailable."
    }

    Run-Native $winget.Source @(
        "install",
        "--id","Microsoft.OpenJDK.17",
        "-e",
        "--source","winget",
        "--accept-source-agreements",
        "--accept-package-agreements"
    )

    $javaHome = Find-Java17Home
}

if (-not $javaHome) {
    throw "Could not locate Java 17 after repair."
}

$env:JAVA_HOME = $javaHome
$env:HADOOP_HOME = "C:\hadoop"

if (-not (Test-Path -LiteralPath "$env:HADOOP_HOME\bin\winutils.exe")) {
    throw "Missing C:\hadoop\bin\winutils.exe"
}

$env:Path = "$env:JAVA_HOME\bin;$env:HADOOP_HOME\bin;$env:Path"

[Environment]::SetEnvironmentVariable("JAVA_HOME",$env:JAVA_HOME,"User")
[Environment]::SetEnvironmentVariable("HADOOP_HOME",$env:HADOOP_HOME,"User")

Write-Host "JAVA_HOME   = $env:JAVA_HOME" -ForegroundColor Green
Write-Host "HADOOP_HOME = $env:HADOOP_HOME" -ForegroundColor Green

Run-Native (Join-Path $env:JAVA_HOME "bin\java.exe") @("-version")

Step "4/9 - Check PySpark"

$pySparkVersion = (& $BigDataPython -c "import pyspark; print(pyspark.__version__)").Trim()

if (-not $pySparkVersion) {
    throw "PySpark is not available in bigdata-pipeline\.venv"
}

Write-Host "PySpark = $pySparkVersion" -ForegroundColor Green

$env:PYSPARK_PYTHON = $BigDataPython
$env:PYSPARK_DRIVER_PYTHON = $BigDataPython

$sparkHome = (& $BigDataPython -c "from pyspark.find_spark_home import _find_spark_home; print(_find_spark_home())").Trim()
$sparkSubmit = Join-Path $sparkHome "bin\spark-submit.cmd"

if (-not (Test-Path -LiteralPath $sparkSubmit)) {
    throw "spark-submit.cmd missing: $sparkSubmit"
}

Write-Host "SPARK_HOME = $sparkHome" -ForegroundColor Green

Step "5/9 - Apply Spark OOM fixes"

$ramGB = [math]::Round(
    (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB,
    1
)

if ($ramGB -ge 32) {
    $driverMem = "12g"
}
elseif ($ramGB -ge 24) {
    $driverMem = "10g"
}
elseif ($ramGB -ge 16) {
    $driverMem = "8g"
}
elseif ($ramGB -ge 12) {
    $driverMem = "6g"
}
else {
    $driverMem = "4g"
}

Write-Host "Physical RAM        = $ramGB GB" -ForegroundColor Green
Write-Host "Spark driver memory = $driverMem" -ForegroundColor Green

# Reduce local concurrency. local[*] was launching many tasks at once,
# which contributed to heap pressure on the 5M-event job.
foreach ($p in @($RunDemo,$SparkSession)) {
    if (Test-Path -LiteralPath $p) {
        $raw = [System.IO.File]::ReadAllText($p)
        $new = $raw.Replace("local[*]","local[4]")

        if ($new -ne $raw) {
            Backup-Once $p
            Write-Utf8 $p $new
            Write-Host "Patched local[*] -> local[4]: $p" -ForegroundColor DarkGray
        }
    }
}

# Change no-argument DataFrame cache/persist to DISK_ONLY in run_demo_pipeline.py.
# This avoids materializing the ~5M event dataset in Java heap.
if (Test-Path -LiteralPath $RunDemo) {
    $raw = [System.IO.File]::ReadAllText($RunDemo)
    $new = $raw

    $needsStorageLevel = $false

    if ($new.Contains(".cache()")) {
        $new = $new.Replace(".cache()", ".persist(StorageLevel.DISK_ONLY)")
        $needsStorageLevel = $true
    }

    # Only replace exact no-argument persist().
    if ($new.Contains(".persist()")) {
        $new = $new.Replace(".persist()", ".persist(StorageLevel.DISK_ONLY)")
        $needsStorageLevel = $true
    }

    if ($needsStorageLevel -and $new -notmatch "from pyspark import StorageLevel") {
        $new = "from pyspark import StorageLevel`r`n" + $new
    }

    if ($new -ne $raw) {
        Backup-Once $RunDemo
        Write-Utf8 $RunDemo $new
        Write-Host "Patched DataFrame cache/persist -> DISK_ONLY." -ForegroundColor Green
    }
}

# Runtime options used by any PySpark Python process launched from this shell.
$env:PYSPARK_SUBMIT_ARGS = "--driver-memory $driverMem --conf spark.sql.inMemoryColumnarStorage.batchSize=1000 --conf spark.sql.shuffle.partitions=64 --conf spark.default.parallelism=64 pyspark-shell"

$sparkTmp = Join-Path $BigData ".spark-tmp"
New-Item -ItemType Directory -Path $sparkTmp -Force | Out-Null
$env:SPARK_LOCAL_DIRS = $sparkTmp

Step "6/9 - Spark smoke test"

$smoke = Join-Path $BigData ".spark_smoke_v2.py"

$smokeCode = @'
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .master("local[2]")
    .appName("medical-device-smoke")
    .getOrCreate()
)

print("SPARK=" + spark.version)
print("ROWS=" + str(spark.range(10).count()))
spark.stop()
'@

Write-Utf8 $smoke $smokeCode

try {
    Run-Native $sparkSubmit @(
        "--master","local[2]",
        "--driver-memory",$driverMem,
        "--conf","spark.sql.inMemoryColumnarStorage.batchSize=1000",
        $smoke
    ) $BigData
}
finally {
    Remove-Item -LiteralPath $smoke -Force -ErrorAction SilentlyContinue
}

Step "7/9 - Patch CAP_NHAT_BIGDATA runtime"

Backup-Once $CapScript
$cap = [System.IO.File]::ReadAllText($CapScript)

$begin = "# >>> FIX_ALL_BIGDATA_V2 >>>"
$end   = "# <<< FIX_ALL_BIGDATA_V2 <<<"

# Remove previous block if script is run again.
$cap = [regex]::Replace(
    $cap,
    "(?s)\r?\n?# >>> FIX_ALL_BIGDATA_V2 >>>.*?# <<< FIX_ALL_BIGDATA_V2 <<<\r?\n?",
    "`r`n"
)

$runtimeBlock = @"
# >>> FIX_ALL_BIGDATA_V2 >>>
# Auto-generated Spark runtime settings.
`$env:JAVA_HOME = "$javaHome"
`$env:HADOOP_HOME = "C:\hadoop"
`$env:Path = "`$env:JAVA_HOME\bin;`$env:HADOOP_HOME\bin;`$env:Path"
`$env:PYSPARK_PYTHON = `$bigdataPython
`$env:PYSPARK_DRIVER_PYTHON = `$bigdataPython
`$env:PYSPARK_SUBMIT_ARGS = "--driver-memory $driverMem --conf spark.sql.inMemoryColumnarStorage.batchSize=1000 --conf spark.sql.shuffle.partitions=64 --conf spark.default.parallelism=64 pyspark-shell"
`$sparkTmp = Join-Path `$bigdata ".spark-tmp"
New-Item -ItemType Directory -Path `$sparkTmp -Force | Out-Null
`$env:SPARK_LOCAL_DIRS = `$sparkTmp
# <<< FIX_ALL_BIGDATA_V2 <<<
"@

# Insert after $eventFile definition if possible.
$pattern = '(?m)^(\$eventFile\s*=.*)$'
if ([regex]::IsMatch($cap,$pattern)) {
    $cap = [regex]::Replace(
        $cap,
        $pattern,
        '$1' + "`r`n`r`n" + $runtimeBlock,
        1
    )
    Write-Utf8 $CapScript $cap
    Write-Host "CAP_NHAT_BIGDATA.ps1 patched." -ForegroundColor Green
}
else {
    Write-Warning "Could not inject runtime block into CAP_NHAT_BIGDATA.ps1. Current run is still configured."
}

Step "8/9 - Run full Big Data rebuild"

if (-not $SkipBigDataRun) {
    # Run in the SAME PowerShell process so JAVA/HADOOP/PYSPARK env variables are inherited.
    & $CapScript

    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "CAP_NHAT_BIGDATA.ps1 returned exit code $LASTEXITCODE"
    }
}
else {
    Write-Host "Skipped full Big Data run by request." -ForegroundColor Yellow
}

Step "9/9 - Final checks"

$generatedDir = Join-Path $BigData "dashboard\data\generated"

if (Test-Path -LiteralPath $generatedDir) {
    $generated = Get-ChildItem -LiteralPath $generatedDir -File -ErrorAction SilentlyContinue
    Write-Host "Generated analytics files: $($generated.Count)" -ForegroundColor Green

    $generated |
        Sort-Object Name |
        Select-Object Name,Length,LastWriteTime |
        Format-Table -AutoSize
}
else {
    Write-Warning "Generated analytics directory not found: $generatedDir"
}

$remaining = @(
    Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.ps1,*.py -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\\.venv\\" -and
            $_.FullName -notmatch "\\node_modules\\"
        } |
        Select-String -Pattern "backend-backup|bigdata-pipeline-backup|lifecycle-backup"
)

if ($remaining.Count -gt 0) {
    Write-Warning "Some old folder references still remain:"
    $remaining | Select-Object Path,LineNumber,Line | Format-Table -AutoSize
}
else {
    Write-Host "No old project-folder references remain in PS1/PY source." -ForegroundColor Green
}

if (-not $SkipStartDemo -and (Test-Path -LiteralPath $StartDemo)) {
    Write-Host ""
    Write-Host "Starting START_DEMO.ps1..." -ForegroundColor Cyan

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy","Bypass",
        "-File","`"$StartDemo`""
    )
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "FIX_ALL_BIGDATA_V2 COMPLETED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "JAVA_HOME : $env:JAVA_HOME"
Write-Host "PySpark   : $pySparkVersion"
Write-Host "Driver RAM: $driverMem"
Write-Host "Spark mode: local[4]"
Write-Host "Cache     : DISK_ONLY where run_demo_pipeline used cache()/persist()"
