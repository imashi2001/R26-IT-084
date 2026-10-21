# Sync canonical waste_forecast into forecast-api before Railway deploy.
$Root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $Root "waste_forecast"
$dst = Join-Path $Root "services\forecast-api\waste_forecast"
Remove-Item -Recurse -Force $dst -ErrorAction SilentlyContinue
Copy-Item -Recurse $src $dst
Write-Host "Synced $src -> $dst"
