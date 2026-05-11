# Railway micro-services

Independent FastAPI services, each Dockerized, each with its own
model file baked in (where applicable).

```
services/
  waste-api/   -> TensorFlow MobileNetV2 (organic / non_organic)
  animal-api/  -> Ultralytics YOLOv8     (cat / crow / dog / monkey)
  litter-severity-api/ -> Ultralytics YOLO + LSI (litter, severity index)
```

Each service exposes `GET /health` and `POST /predict` (multipart `file`).

## Deploy on Railway

Repeat for each service:

1. **New Project -> Deploy from GitHub Repo** (use this same repo).
2. **Settings -> Service -> Root Directory**:
   - `services/waste-api` for the waste service
   - `services/animal-api` for the animal service
   - `services/litter-severity-api` for litter severity (place `model/best.pt` in repo or build context)
3. Railway auto-detects the `Dockerfile`. No start command override needed.
4. **Networking -> Generate Domain** to get the public URL.

Do not set `PORT`. Railway injects it; the Dockerfile binds `0.0.0.0:${PORT}`.

## Local Docker test

```powershell
cd services\waste-api
docker build -t waste-api .
docker run --rm -p 8000:8000 -e PORT=8000 waste-api

curl -F "file=@some.jpg" http://127.0.0.1:8000/predict
```

```powershell
cd services\animal-api
docker build -t animal-api .
docker run --rm -p 8001:8000 -e PORT=8000 animal-api

curl -F "file=@some.jpg" http://127.0.0.1:8001/predict
```

```powershell
cd services\litter-severity-api
docker build -t litter-severity-api .
docker run --rm -p 8003:8000 -e PORT=8000 litter-severity-api

curl -F "file=@some.jpg" http://127.0.0.1:8003/predict
```

If `/predict` returns JSON locally, Railway will work.

**Compose (repo root):** `docker-compose.litter.yml` builds `services/litter-severity-api` on port **8003**. From `litter_severity_detection/`, use `docker-compose.yml` instead (see `litter_severity_detection/DOCKER.md`).

After deploying, point the main backend at the microservice base URLs (no `/predict` suffix — the gateway adds it):

```powershell
$env:MODEL_WASTE_URL   = "https://waste-api-xxx.up.railway.app"
$env:MODEL_ANIMAL_URL = "https://animal-api-xxx.up.railway.app"
$env:MODEL_LITTER_URL = "https://litter-severity-api-xxx.up.railway.app"
```

(Express `env.js` normalizes these; `modelClient` calls `POST {base}/predict`.)
