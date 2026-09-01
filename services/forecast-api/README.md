# forecast-api (XGBoost waste forecasting)

FastAPI microservice for **municipal waste KG forecasting** used by the Express backend:

- `POST /predict` — batch feature rows → KG predictions
- `GET /insights` — seasonal insights for dashboard charts
- `GET /health` — model load status

Weights live in repo `waste_forecast/models/` (XGBoost `model.json` + daily profiles).

## Local run

From **repo root** (needs `waste_forecast/` folder):

```powershell
cd services\forecast-api
pip install -r requirements.txt
$env:WORKSPACE_ROOT = (Resolve-Path ..\..).Path
$env:PORT = 8006
uvicorn app:app --host 0.0.0.0 --port 8006
```

Test:

```powershell
curl http://127.0.0.1:8006/health
```

## Docker (same as Railway)

Build from **repo root**:

```powershell
docker build -f services/forecast-api/Dockerfile -t forecast-api .
docker run --rm -p 8006:8000 -e PORT=8000 forecast-api
```

## Deploy on Railway

Because the model files are in `waste_forecast/` at repo root, use **monorepo build**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `.` (repo root, not `services/forecast-api`) |
| **Dockerfile Path** | `services/forecast-api/Dockerfile` |
| **Generate Domain** | e.g. `https://forecast-api-xxx.up.railway.app` |

Do **not** override `PORT` — Railway injects it.

## Wire backend (Railway)

On your **Express backend** service, set:

```env
MODEL_FORECAST_URL=https://forecast-api-xxx.up.railway.app
FORECAST_TIMEOUT_MS=45000
```

Redeploy backend. The dashboard **Forecasting** page calls:

- `GET /api/waste-data?date=YYYY-MM-DD`
- `GET /api/waste-trend?date=&location=`
- `GET /api/waste-insights`

All of those route through this service when `MODEL_FORECAST_URL` is set.

## Local backend without Railway model

Leave `MODEL_FORECAST_URL` empty in `backend/.env`. The backend runs local Python scripts in `forecasting dashboard/` (requires Python + xgboost on your PC).

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/health` | — | `{ ok, model_path, error }` |
| POST | `/predict` | `{ "rows": [...], "mode": "auto" \| "trend" }` | `{ predictions, reliability, reliabilityNote }` |
| GET | `/insights` | — | seasonal insight JSON |
