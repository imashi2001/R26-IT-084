# model-yolo (YOLO inference microservice)

Standalone Flask service that runs the trained YOLOv8 model.

It is intentionally tiny: no DB, no auth, no users.
The main backend (gateway) calls this service over HTTP.

## Endpoints

| Method | Path     | Body                                | Returns                                      |
|--------|----------|-------------------------------------|----------------------------------------------|
| GET    | /health  | -                                   | `{ status, service, model, weights }`        |
| POST   | /infer   | multipart `image` (file), `conf` (form) | `{ model, predictions: [{label, confidence, box}] }` |

## Run locally

```powershell
cd model-yolo
C:\genv\Scripts\python.exe -m pip install -r requirements.txt
C:\genv\Scripts\python.exe server.py
```

Default port: `6000` (override with `PORT` env var).

## Deploy on Railway

- Root directory: `model-yolo`
- **Custom start command:** leave empty (Dockerfile `ENTRYPOINT` runs gunicorn and reads `PORT`). If you must set one, never use `$PORT` in the dashboard — it is not expanded by a shell; use only the Dockerfile default.
- Required file: `model/best.pt` must be committed (or mounted via volume).
- Expose service URL and pass it to backend as `MODEL_YOLO_URL`.
