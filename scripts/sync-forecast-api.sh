#!/usr/bin/env bash
# Copy canonical waste_forecast/ into services/forecast-api/ for Railway Docker build context.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/services/forecast-api/waste_forecast"
cp -R "$ROOT/waste_forecast" "$ROOT/services/forecast-api/waste_forecast"
echo "Synced waste_forecast -> services/forecast-api/waste_forecast"
