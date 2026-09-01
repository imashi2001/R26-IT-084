# forecast-api (XGBoost waste forecasting)

FastAPI microservice for **municipal waste KG forecasting** (Adheeshana pipeline) used by the Express backend.

## Railway deploy (recommended)

| Setting | Value |
|---------|--------|
| **Root Directory** | `services/forecast-api` |
| **Dockerfile Path** | `Dockerfile` (default) |
| **Generate Domain** | e.g. `https://forecast-api-xxx.up.railway.app` |

The Docker build context is **`services/forecast-api` only**. Model files live in `services/forecast-api/waste_forecast/` (copied from repo root `waste_forecast/`).

After editing the canonical model at repo root `waste_forecast/`, sync before deploy:

```powershell
.\scripts\sync-forecast-api.ps1
git add services/forecast-api/waste_forecast
git commit -m "sync waste_forecast for forecast-api"
git push
```

## Wire Express backend

```env
MODEL_FORECAST_URL=https://forecast-api-xxx.up.railway.app
FORECAST_TIMEOUT_MS=45000
```

## Local Docker test

```powershell
cd services\forecast-api
docker build -t forecast-api .
docker run --rm -p 8006:8000 -e PORT=8000 forecast-api
curl http://127.0.0.1:8006/health
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Model file present |
| POST | `/predict` | `{ rows, mode: "auto" \| "trend" }` |
| GET | `/insights` | Seasonal dashboard insights |
| GET | `/registry` | Retrain history |
| POST | `/retrain` | Validation-gated retrain |

See also: `waste_forecast/README.md` (canonical model docs).
