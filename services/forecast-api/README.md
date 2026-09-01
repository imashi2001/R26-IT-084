# forecast-api (XGBoost waste forecasting)

FastAPI microservice for **municipal waste KG forecasting** used by the Express backend.

## Railway deploy

| Setting | Value |
|---------|--------|
| **Root Directory** | `.` (repository root) |
| **Dockerfile Path** | `services/forecast-api/Dockerfile` |
| **Branch** | `test` (or your branch with `services/forecast-api/waste_forecast/` committed) |

Railway uses the **repo root** as the Docker build context. The Dockerfile copies:

- `services/forecast-api/requirements.txt`
- `services/forecast-api/app.py`
- `services/forecast-api/waste_forecast/` → `/app/waste_forecast/`

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

## Local Docker test (from repo root)

```powershell
docker build -f services/forecast-api/Dockerfile -t forecast-api .
docker run --rm -p 8006:8000 -e PORT=8000 forecast-api
curl http://127.0.0.1:8006/health
```
