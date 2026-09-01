# forecast-api (XGBoost waste forecasting)

FastAPI microservice for **municipal waste KG forecasting** (Adheeshana pipeline) used by the Express backend.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Model file present |
| POST | `/predict` | `{ rows, mode: "auto" \| "trend" }` → KG predictions |
| GET | `/insights` | Seasonal dashboard insights |
| GET | `/registry` | Model retrain history |
| POST | `/retrain` | `{ entries, force }` — validation-gated retrain |

Model weights: repo root `waste_forecast/models/` (copied into the container at build time).

## Local run

From **repo root**:

```powershell
cd services\forecast-api
pip install -r requirements.txt
$env:WORKSPACE_ROOT = (Resolve-Path ..\..).Path
$env:PORT = 8006
uvicorn app:app --host 0.0.0.0 --port 8006 --app-dir .
```

Copy `app.py` cwd: run from `services/forecast-api` with `WORKSPACE_ROOT` pointing to repo root.

Test:

```powershell
curl http://127.0.0.1:8006/health
```

## Docker

Build from **repository root** (required — model lives outside this folder):

```powershell
cd C:\path\to\R26-IT-084
docker build -f services/forecast-api/Dockerfile -t forecast-api .
docker run --rm -p 8006:8000 -e PORT=8000 forecast-api
```

## Deploy on Railway

| Setting | Value |
|---------|--------|
| **Root Directory** | `.` (repository root, not `services/forecast-api`) |
| **Dockerfile Path** | `services/forecast-api/Dockerfile` |
| **Generate Domain** | e.g. `https://forecast-api-xxx.up.railway.app` |

Do **not** override `PORT` — Railway injects it.

## Wire Express backend

```env
MODEL_FORECAST_URL=https://forecast-api-xxx.up.railway.app
FORECAST_TIMEOUT_MS=45000
FORECAST_RETRAIN_TIMEOUT_MS=120000
```

Dashboard routes that use this service:

- `GET /api/waste-data`
- `GET /api/waste-trend`
- `GET /api/waste-insights`
- `POST /api/waste-entries` (auto-retrain → `POST /retrain`)

## Local backend without Railway

Leave `MODEL_FORECAST_URL` empty. Backend runs `forecasting dashboard/run_model.py` (requires local Python + xgboost).

See also: `waste_forecast/README.md`
