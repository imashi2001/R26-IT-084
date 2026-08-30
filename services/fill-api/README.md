# fill-api (bin fill level — YOLOv8n)

FastAPI microservice for **garbage fill level detection** (`Empty` / `Half` / `Overflow`).

Uses weights from training run **`garbage_fill_level_detection_v1`** (YOLOv8n, 640px).

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/health` | — | `{ ok, model_loaded, model_path }` |
| POST | `/predict` | multipart **`file`** | `{ predictions, detections, annotated_image_base64, ... }` |

## Install weights locally

```powershell
Copy-Item ..\..\garbage_fill_level_detection_v1\weights\best.pt .\model\best.pt
```

Or from repo root:

```powershell
.\scripts\install_fill_model.ps1
```

## Run locally

```powershell
cd services\fill-api
pip install -r requirements.txt
$env:PORT=8005
uvicorn app:app --host 0.0.0.0 --port 8005
```

Test:

```powershell
curl -F "file=@test.jpg" http://127.0.0.1:8005/predict
```

## Deploy on Railway

1. **New service** → root directory: `services/fill-api`
2. Ensure `model/best.pt` is committed (or copy before deploy)
3. **Generate domain** → e.g. `https://fill-api-xxx.up.railway.app`
4. On the **backend** service set:

```env
MODEL_FILL_URL=https://fill-api-xxx.up.railway.app
```

(`MODEL_YOLO_URL` still works for backward compatibility but is deprecated.)

## Backend wiring

The Express gateway calls `POST /predict` on this service when `MODEL_FILL_URL` is set.
Response labels are normalized to `empty` | `half` | `overflow` for `bin_fill_level` tier mapping.
