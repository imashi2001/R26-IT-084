# Quick smoke test for littering-action-api (run in a second terminal while service is up)
# Usage:
#   .\test-local.ps1
#   .\test-local.ps1 -ImagePath "C:\path\to\test.jpg"
#   .\test-local.ps1 -BaseUrl "http://localhost:8004"

param(
  [string]$BaseUrl = "http://localhost:8004",
  [string]$ImagePath = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=== Health ===" -ForegroundColor Cyan
try {
  $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
  $health | ConvertTo-Json -Depth 6
  if (-not $health.model_loaded) {
    Write-Host "WARNING: model_loaded is false. Check weights/best.pt" -ForegroundColor Yellow
  }
} catch {
  Write-Host "FAILED: Could not reach $BaseUrl/health" -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "Start the service first: .\run-local.ps1"
  exit 1
}

if (-not $ImagePath) {
  $candidates = @(
    "..\..\animal_detection\dataset\train\images",
    "..\..\litter_severity_detection\dataset\images\train"
  )
  foreach ($dir in $candidates) {
    if (Test-Path $dir) {
      $img = Get-ChildItem $dir -Include *.jpg,*.jpeg,*.png -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($img) { $ImagePath = $img.FullName; break }
    }
  }
}

if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
  Write-Host ""
  Write-Host "No test image found. Re-run with:" -ForegroundColor Yellow
  Write-Host '  .\test-local.ps1 -ImagePath "C:\path\to\your\test.jpg"'
  exit 0
}

Write-Host ""
Write-Host "=== Predict ($ImagePath) ===" -ForegroundColor Cyan

$boundary = [System.Guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes($ImagePath)
$fileName = [System.IO.Path]::GetFileName($ImagePath)

$bodyLines = @(
  "--$boundary",
  "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
  "Content-Type: image/jpeg",
  "",
  [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
  "--$boundary--",
  ""
)
$body = $bodyLines -join "`r`n"

try {
  $predict = Invoke-RestMethod -Uri "$BaseUrl/predict" -Method Post `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body))
  $predict | ConvertTo-Json -Depth 8
  Write-Host ""
  if ($predict.event_detected) {
    Write-Host "Result: LITTERING EVENT DETECTED (count=$($predict.event_count), conf=$($predict.max_confidence))" -ForegroundColor Yellow
  } else {
    Write-Host "Result: No littering event detected" -ForegroundColor Green
  }
} catch {
  Write-Host "Predict failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}
