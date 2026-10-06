param(
    [switch]$RunSpark,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$bigdata = Join-Path $root 'bigdata-pipeline'
$backendPython = Join-Path $backend '.venv\Scripts\python.exe'

if ($BackendOnly) {
    Set-Location $backend
    & $backendPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. See Alembic output; backend was not started.' }
    Write-Host 'Starting MedDevice FastAPI on http://127.0.0.1:8000 ...' -ForegroundColor Cyan
    & $backendPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
    return
}
if ($FrontendOnly) {
    Set-Location $frontend
    Write-Host 'Starting MedDevice React on http://127.0.0.1:5173 ...' -ForegroundColor Cyan
    & npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
    return
}

foreach ($dir in @($backend, $frontend, $bigdata)) {
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
        throw "Missing project folder: $dir. Copy this script to the project root."
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $backend '.env') -PathType Leaf)) {
    throw 'Missing backend\.env. Restore the existing configured .env; do not overwrite credentials with .env.example.'
}
if (-not (Test-Path -LiteralPath $backendPython -PathType Leaf)) {
    throw 'Backend venv not found. Complete the initial setup in backend first.'
}
if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules\.bin\vite.cmd') -PathType Leaf)) {
    throw 'Frontend dependencies missing. Run npm install once in frontend.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker command not found. Install/start Docker Desktop first.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd not found. Install Node.js/npm first.'
}

Write-Host '[1/3] PostgreSQL...' -ForegroundColor Cyan
$existing = @(docker ps -a --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable. Start Docker Desktop and retry.' }
if ($existing -contains 'meddevice-postgres') {
    $running = @(docker ps --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read running Docker containers.' }
    if ($running -contains 'meddevice-postgres') {
        Write-Host 'Existing meddevice-postgres is already running.' -ForegroundColor Green
    }
    else {
        & docker start meddevice-postgres
        if ($LASTEXITCODE -ne 0) { throw 'Cannot start existing meddevice-postgres container.' }
    }
}
else {
    Write-Host 'No existing meddevice-postgres. Starting it through the project Compose file...' -ForegroundColor Yellow
    & docker compose -f (Join-Path $backend 'docker-compose.yml') up -d postgres
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL Compose startup failed. Check Docker Desktop and host port 5434.' }
}

$databaseReady = $false
for ($i = 0; $i -lt 30; $i++) {
    & docker exec meddevice-postgres pg_isready -U postgres -d meddevice *> $null
    if ($LASTEXITCODE -eq 0) { $databaseReady = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $databaseReady) { throw 'PostgreSQL did not become ready. Inspect the meddevice-postgres container logs.' }
Write-Host 'PostgreSQL is ready.' -ForegroundColor Green

Write-Host '[2/4] Applying additive database migrations...' -ForegroundColor Cyan
Push-Location $backend
try {
    & $backendPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw 'Database migration failed. Check the Alembic error and back up the database before retrying.'
    }
} finally {
    Pop-Location
}
Write-Host 'Database schema is up to date.' -ForegroundColor Green

function Test-PortListening([int]$port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1)
}
function Test-Backend {
    try {
        $r = Invoke-WebRequest `
            -Uri 'http://127.0.0.1:8000/ready' `
            -TimeoutSec 5 `
            -UseBasicParsing

        $body = $r.Content | ConvertFrom-Json
        return ($r.StatusCode -eq 200 -and $body.version -eq '2.4.0')

    }
    catch {
        return $false
    }
}
function Test-Frontend {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -TimeoutSec 5 -UseBasicParsing

        return ($r.StatusCode -eq 200 -and $r.Content -match 'name="meddevice-version" content="2.4.0"')

    } catch { 
        return $false 
    }
}

Write-Host '[3/4] FastAPI...' -ForegroundColor Cyan
if (Test-PortListening 8000) {
    if (-not (Test-Backend)) { throw 'Port 8000 is occupied by an older or unhealthy backend. Close its PowerShell window and rerun START_DEMO.ps1.' }
    Write-Host 'FastAPI is already running; reusing it.' -ForegroundColor Green
}
else {
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $backend -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`" -BackendOnly"
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-Backend) { $ok = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw 'FastAPI did not pass /ready. Inspect the new FastAPI PowerShell window.' }
    Write-Host 'FastAPI /ready passed.' -ForegroundColor Green
}

Write-Host '[4/4] React/Vite...' -ForegroundColor Cyan
if (Test-PortListening 5173) {
    if (-not (Test-Frontend)) { throw 'Port 5173 is occupied by an older or unhealthy frontend. Close its PowerShell window and rerun START_DEMO.ps1.' }
    Write-Host 'MedDevice frontend is already running; reusing it.' -ForegroundColor Green
}
else {
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $frontend -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`" -FrontendOnly"
    $ok = $false
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-Frontend) { $ok = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw 'Frontend did not respond. Inspect the new React/Vite PowerShell window.' }
    Write-Host 'Frontend HTTP check passed.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'MedDevice ready: http://127.0.0.1:5173' -ForegroundColor Green
Write-Host 'FastAPI docs:    http://127.0.0.1:8000/docs'
Write-Host 'Keep the FastAPI and React terminal windows open during the demo.'
Write-Host 'Spark is a batch job, not a permanent server. Run CAP_NHAT_BIGDATA.ps1 when event data changes.'

if ($RunSpark) {
    Write-Host 'Running the optional Spark batch now...' -ForegroundColor Cyan
    & (Join-Path $root 'CAP_NHAT_BIGDATA.ps1')
}
Start-Process 'http://127.0.0.1:5173'
