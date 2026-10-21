# Run littering-action-api locally (PowerShell)
# Prerequisites: Python 3.11+ with pip
#
# Usage:
#   cd services\littering-action-api
#   .\run-local.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".\weights\best.pt")) {
  Write-Host "ERROR: weights\best.pt not found." -ForegroundColor Red
  Write-Host "Copy your trained model to: $here\weights\best.pt"
  exit 1
}

$py = $null
foreach ($candidate in @("py -3.11", "py -3", "python", "python3")) {
  try {
    $cmd = $candidate.Split(" ")[0]
    $args = @()
    if ($candidate -match " ") { $args = $candidate.Split(" ")[1..99] }
    & $cmd @args -c "import sys; print(sys.version)" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $py = $candidate; break }
  } catch {}
}

if (-not $py) {
  Write-Host "ERROR: Python not found. Install Python 3.11+ from https://www.python.org/downloads/" -ForegroundColor Red
  Write-Host "Or start Docker Desktop and run: docker compose -f ..\..\docker-compose.litter.yml up littering-action-api --build"
  exit 1
}

Write-Host "Using: $py" -ForegroundColor Cyan
& $py.Split(" ")[0] @($py.Split(" ")[1..99]) -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:PORT = "8004"
$env:LITTERING_MODEL_PATH = "$here\weights\best.pt"
$env:LITTERING_DEVICE = "cpu"

Write-Host ""
Write-Host "Starting on http://localhost:8004" -ForegroundColor Green
Write-Host "  Health:  http://localhost:8004/health"
Write-Host "  Predict: POST http://localhost:8004/predict  (multipart field: file)"
Write-Host ""

& $py.Split(" ")[0] @($py.Split(" ")[1..99]) -m uvicorn app:app --host 0.0.0.0 --port 8004
