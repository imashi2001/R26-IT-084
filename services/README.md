# Railway micro-services

Two independent FastAPI services, each Dockerized, each with its own
model file baked in.

```
services/
  waste-api/           -> TensorFlow MobileNetV2 (organic / non_organic)
  animal-api/          -> Ultralytics YOLOv8     (cat / crow / dog / monkey)
  litter-severity-api/ -> Ultralytics YOLO + LSI (litter severity; see `MODEL_LITTER_URL` on Express)
  littering-action-api/ -> Ultralytics YOLO11 littering-event detector (`MODEL_LITTERING_ACTION_URL`)
```

Each service exposes `GET /health` and `POST /predict` (multipart `file`).  
The Express gateway exposes **`POST /litter-severity`** (multipart `image`) which forwards to litter-severity-api as `file`.

## Deploy on Railway

Repeat for each service:

1. **New Project -> Deploy from GitHub Repo** (use this same repo).
2. **Settings -> Service -> Root Directory**:
   - `services/waste-api` for the waste service
   - `services/animal-api` for the animal service
   - `services/litter-severity-api` for litter severity (add **`model/best.pt`** in the image or mount weights; see that service’s `Dockerfile`)
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

If `/predict` returns JSON locally, Railway will work.

## Calling from the orchestrator

After deploying, point the main backend at the two URLs:

```powershell
$env:WASTE_API_URL  = "https://waste-api-xxx.up.railway.app/predict"
$env:ANIMAL_API_URL = "https://animal-api-xxx.up.railway.app/predict"
```

(The orchestrator code change to fan out to these instead of loading
models in-process is a separate task.)
