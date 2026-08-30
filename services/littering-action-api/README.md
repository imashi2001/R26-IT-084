# Littering Action API

Ultralytics YOLO11 frame-level **littering-event** detector (person/action throwing or leaving garbage near a bin).

This service is separate from `litter-severity-api`, which detects individual litter objects and computes the Litter Severity Index (LSI).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service + model status |
| POST | `/predict` | Multipart `file` (JPEG/PNG), optional `confidence`, `iou`, `include_annotated_image` |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP port (Railway injects this) |
| `LITTERING_MODEL_PATH` | `/app/weights/best.pt` | Model checkpoint path |
| `LITTERING_CONFIDENCE` | `0.50` | Default confidence threshold |
| `LITTERING_IOU` | `0.45` | NMS IoU |
| `LITTERING_MAX_DETECTIONS` | `100` | Max boxes per frame |
| `LITTERING_DEVICE` | `cpu` | `cpu` or `cuda`/`0` when GPU available |

## Model weights

Place your trained checkpoint at:

```
services/littering-action-api/weights/best.pt
```

The Docker image copies `weights/` into `/app/weights/`.

## Local run

```powershell
cd services\littering-action-api
pip install -r requirements.txt
$env:PORT = "8004"
python -m uvicorn app:app --host 0.0.0.0 --port 8004
```

## Docker

```powershell
cd services\littering-action-api
docker build -t littering-action-api .
docker run --rm -p 8004:8000 -e PORT=8000 littering-action-api
```

## Railway

1. New service → root directory `services/littering-action-api`
2. Use the included `Dockerfile` (no custom start command)
3. Generate domain → set backend `MODEL_LITTERING_ACTION_URL=https://<service>.up.railway.app`

## Tests

```powershell
cd services\littering-action-api
pip install pytest httpx
pytest tests/ -v
```
