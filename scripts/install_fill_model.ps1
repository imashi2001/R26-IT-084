# Copy trained fill-level weights into services/fill-api/model/best.pt
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "garbage_fill_level_detection_v1\weights\best.pt"
$destDir = Join-Path $root "services\fill-api\model"
$dest = Join-Path $destDir "best.pt"

if (-not (Test-Path $src)) {
  Write-Error "Source not found: $src`nTrain or download garbage_fill_level_detection_v1/weights/best.pt first."
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -Force $src $dest
Write-Host "Installed fill model -> $dest"
