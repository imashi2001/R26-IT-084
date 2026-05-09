# VisionWaste bridge

Python script that polls your **ESP32-CAM** snapshot URL on the LAN and POSTs each JPEG to your **Express** backend on Railway (`POST /predict`).

Railway **cannot** reach `http://10.x.x.x` — only a machine on your Wi‑Fi (this laptop) can. This bridge closes that gap.

## Prerequisites

- ESP32 serving a JPEG at e.g. `http://10.134.126.191/capture`
- Railway **backend** URL including **`https://`** and path **`/predict`**

## Install

**PowerShell:**

```powershell
cd VisionWaste\bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**bash:**

```bash
cd VisionWaste/bridge
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

Set **`BACKEND_PREDICT_URL`** to your real Express service (must start with `https://`):

**PowerShell:**

```powershell
$env:ESP32_CAPTURE_URL = "http://10.134.126.191/capture"
$env:BACKEND_PREDICT_URL = "https://your-backend.up.railway.app/predict"
python bridge.py
```

**bash:**

```bash
export ESP32_CAPTURE_URL=http://10.134.126.191/capture
export BACKEND_PREDICT_URL=https://your-backend.up.railway.app/predict
python bridge.py
```

### Optional environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `POLL_INTERVAL_SEC` | `5` | Seconds between capture cycles |
| `ESP32_TIMEOUT` | `10` | GET snapshot timeout (seconds) |
| `BACKEND_TIMEOUT` | `120` | POST /predict timeout (YOLO can be slow) |
| `BACKEND_MAX_RETRIES` | `3` | Retries if backend returns 5xx or network error |
| `BACKEND_RETRY_DELAY_SEC` | `2` | Pause between retries |

## Output files

- `captures/latest.jpg` — overwritten each cycle
- `captures/snapshot_YYYYMMDD_HHMMSS.jpg` — archive per fetch

(JPEG files under `captures/` are gitignored.)

## Console messages

Each cycle prints:

1. `Getting image from ESP32...`
2. `Sending image to backend...`
3. `Prediction received` plus pretty-printed JSON from Express

## Backend contract (Express)

This repo gateway expects:

- **Method:** `POST`
- **Path:** `/predict`
- **Body:** `multipart/form-data`, field name **`image`** (file)

Response: JSON **array** of detections, e.g.

```json
[
  { "label": "Half", "confidence": 0.87, "box": [10.2, 20.5, 200.0, 180.0] }
]
```
