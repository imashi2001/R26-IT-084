# waste_forecast — Adheeshana municipal waste forecasting

XGBoost model and Python pipeline for **location × category waste KG forecasts** on the dashboard `/forecast` page.

## Layout

```
waste_forecast/
├── models/
│   ├── model.json              # Live XGBoost weights
│   ├── model_candidate.json    # Candidate during retrain
│   ├── model_registry.json     # Retrain history (RMSE, promoted flag)
│   ├── feature_columns.json
│   └── daily_profile.json
└── src/
    ├── predict_service.py      # Shared row → KG prediction (single source of truth)
    ├── daily_forecast.py       # Daily municipal tons estimate
    ├── calendar_features.py    # Holidays, Poya, weekends
    ├── load_data.py            # Institute/category shares + baselines
    ├── features.py             # Monthly feature table for retrain
    └── retrain_pipeline.py     # Validation-gated model promotion
```

## How it connects to VisionWaste

```text
Dashboard /forecast
  → GET /api/waste-data, /api/waste-trend, /api/waste-insights
  → Express backend (backend/routes/wastedata.routes.js)
  → backend/services/forecastModelClient.js
       ├─ MODEL_FORECAST_URL set → services/forecast-api (Railway)
       └─ unset → forecasting dashboard/run_model.py (local Python)

Dashboard /waste-update
  → POST /api/waste-entries
  → MySQL waste_entries (or JSON fallback)
  → Auto-retrain at 30 unprocessed entries
  → forecast-api POST /retrain (Railway) or local retrain_pipeline.py
```

**Canonical model path:** repo root `waste_forecast/` only. Do not maintain a second copy under `services/forecast-api/`.

## Railway

| Service | Root Directory | Dockerfile |
|---------|----------------|------------|
| forecast-api | `.` (repo root) | `services/forecast-api/Dockerfile` |
| Express backend | `backend` | — |

Backend env:

```env
MODEL_FORECAST_URL=https://your-forecast-api.up.railway.app
FORECAST_TIMEOUT_MS=45000
FORECAST_RETRAIN_TIMEOUT_MS=120000
```

## Local dev (no forecast-api)

1. Install Python deps: `pip install xgboost pandas numpy fastapi` (see `services/forecast-api/requirements.txt`).
2. Leave `MODEL_FORECAST_URL` empty in `backend/.env`.
3. Backend runs `forecasting dashboard/run_model.py` which imports `waste_forecast/src/predict_service.py`.

## Retrain flow

1. Field staff submit entries via `/waste-update`.
2. Backend exports all rows and POSTs them to `forecast-api/retrain` (or runs `retrain_pipeline.py` locally).
3. Pipeline trains candidate, compares RMSE to live model, promotes if within 2%.
4. Backend marks MySQL rows `processed_for_training = true`.
5. Registry visible via `GET /api/waste-entries/retrain-status` (proxies `forecast-api/registry` when remote).

## Related (different feature)

Per-bin **hygienic risk** forecast (`/forecast/:binId`) uses `backend/services/forecastService.js` — not this XGBoost pipeline.
