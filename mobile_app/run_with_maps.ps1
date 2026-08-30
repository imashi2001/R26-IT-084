# Run VisionWaste mobile app with MapTiler (reads mobile_app/dart_defines.json).
Set-Location $PSScriptRoot
if (-not (Test-Path "dart_defines.json")) {
  Write-Error "Missing dart_defines.json — copy dart_defines.example.json and add your MAPTILER_KEY."
  exit 1
}
flutter run --dart-define-from-file=dart_defines.json @args
