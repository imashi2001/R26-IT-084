# forecast-api (XGBoost waste forecasting)

FastAPI microservice for **municipal waste KG forecasting** used by the Express backend.

## Railway deploy

| Setting | Value |
|---------|--------|
| **Root Directory** | `services/forecast-api` |
| **Dockerfile Path** | `Dockerfile` (leave default / empty) |
| **Branch** | `test` |

Build context is **`services/forecast-api`** only. Model files must live in `services/forecast-api/waste_forecast/` (synced from repo root `waste_forecast/`).

**Important:** After editing canonical model at repo root `waste_forecast/`, sync before commit:

```powershell
.\scripts\sync-forecast-api.ps1
git add services/forecast-api/waste_forecast services/forecast-api/Dockerfile
git commit -m "sync forecast-api model"
git push
```

Ensure the Railway service is connected to the branch you push (e.g. `test`).

## Backend env

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
