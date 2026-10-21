# Run VisionWaste mobile app with MapTiler (reads dart_defines.json in this folder).
Set-Location $PSScriptRoot

if (-not (Test-Path "dart_defines.json")) {
  Write-Error "Missing dart_defines.json. Copy dart_defines.example.json and add your MAPTILER_KEY."
  exit 1
}

$phone = flutter devices --machine | ConvertFrom-Json |
  Where-Object { $_.targetPlatform -like "android*" -and -not $_.emulator } |
  Select-Object -First 1

if ($phone) {
  Write-Host "Using phone: $($phone.name) ($($phone.id))"
  flutter run -d $phone.id --dart-define-from-file=dart_defines.json @args
} else {
  Write-Host "No Android phone detected. Connect USB and enable USB debugging."
  flutter run --dart-define-from-file=dart_defines.json @args
}
