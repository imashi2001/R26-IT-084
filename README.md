# R26-IT-084

Avoiding inconvenience to people due to irregular waste.

## Architecture (separated services)

```
frontend/      React app (UI)
backend/       Express.js API gateway (no ML, talks to model services + DB)
model-yolo/    Standalone YOLOv8 inference microservice (Python)
dataset/       Training data (only needed for training)
train.py       YOLO training entrypoint -> writes to model-yolo/model/best.pt
test.py        Quick CLI inference test
VisionWaste/   ESP32 bridge (Python, LAN laptop → Railway backend)
```

The frontend talks **only** to `backend`.
`backend` talks **only** to model microservices over HTTP.
Each model is a separate process so model dependencies (torch, ultralytics, etc.)
never leak into the gateway and other team members' models.

```
Frontend (3000)
   |  POST /predict
   v
Backend gateway (5000) — Express.js
   |  POST /infer  (multipart image)
   v
model-yolo service (6000) — Python  (best.pt lives here)
```

When new models are added, deploy them as additional services
(e.g. `model-binlevel/`) and register their URL in `MODEL_REGISTRY` inside
[backend/config/env.js](backend/config/env.js).

## ESP32-CAM and LAN constraint

Private IPs (`http://10.x.x.x/...`) are **not reachable from Railway**.
Use **`VisionWaste/bridge/`** on a laptop on the same Wi‑Fi: it snapshots the ESP32 and POSTs to your HTTPS backend.

See [VisionWaste/bridge/README.md](VisionWaste/bridge/README.md).

From **`npm start` on HTTP localhost**, you can also use **Load from ESP32** in the UI.
Deployed **`https://`** frontend **cannot** fetch **`http://`** ESP32 (mixed content); use the bridge.

## Railway / env reminders

Always use **full URLs with scheme**:

| Variable | Example |
|----------|---------|
| `MODEL_YOLO_URL` (backend) | `https://your-model.up.railway.app` |
| `REACT_APP_API_URL` (frontend build) | `https://your-backend.up.railway.app` |
| Bridge `BACKEND_PREDICT_URL` | `https://your-backend.up.railway.app/predict` |

Host-only strings like `something.up.railway.app` are normalized to **`https://`** where applicable (`MODEL_YOLO_URL`, `REACT_APP_API_URL`).

Optional backend **`CORS_ORIGIN`**: comma-separated allowed frontend origins (empty = allow all). See [backend/.env.example](backend/.env.example).

Frontend local overrides: copy [frontend/.env.example](frontend/.env.example) to **`frontend/.env.local`** (`REACT_APP_API_URL`, `REACT_APP_ESP32_CAPTURE_URL`).

## Run locally (3 terminals)

Terminal 1 - YOLO model service:
```powershell
cd model-yolo
C:\genv\Scripts\python.exe -m pip install -r requirements.txt
C:\genv\Scripts\python.exe server.py
```
Listens on http://localhost:6000

Terminal 2 - Backend gateway (Express):
```powershell
cd backend
npm install
npm start
```
Listens on http://localhost:5000. Reads config from `backend/.env`
(create one based on `.env.example`). Root **`GET /`** returns API pointers JSON.

Terminal 3 - Frontend:
```powershell
cd frontend
npm install
npm start
```
Open http://localhost:3000.

## Deploy on Railway

Create one Railway project with three services:

1. **model-yolo** — root: `model-yolo`; uses `Dockerfile` (leave Railway **custom start command** empty so `$PORT` is not passed literally).
2. **backend** — root: `backend`, start: `npm start`,
   set `MODEL_YOLO_URL` to the **https://** public URL of the `model-yolo` service.
3. **frontend** — root: `frontend`, build: `npm run build`, set `REACT_APP_API_URL` to the **https://** public URL of `backend`.

Add Railway Postgres later when you wire users / history into the gateway.
