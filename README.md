# R26-IT-084

Avoiding inconvenience to people due to irregular waste.

## Architecture (separated services)

```
frontend/      React app (UI)
backend/       Express.js API gateway (no ML, talks to model services + DB)
services/      Model microservices (waste, animal, fill, litter, …)
garbage_fill_level_detection_v1/  Trained fill-level weights (copy to services/fill-api/model/)
dataset/       Training data (only needed for training)
train.py       YOLO training entrypoint -> writes to services/fill-api/model/best.pt
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
   |  POST /predict  (multipart file)
   v
fill-api service (8005) — FastAPI  (garbage_fill_level_detection_v1 / best.pt)
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
| `MODEL_FILL_URL` (backend) | `https://fill-api-xxx.up.railway.app` |
| `VITE_API_URL` (frontend build) | `https://your-backend.up.railway.app` |
| Bridge `BACKEND_PREDICT_URL` | `https://your-backend.up.railway.app/predict` |

Host-only strings like `something.up.railway.app` are normalized to **`https://`** where applicable (`MODEL_FILL_URL`, `VITE_API_URL`).

Optional backend **`CORS_ORIGIN`**: comma-separated allowed frontend origins (empty = allow all). See [backend/.env.example](backend/.env.example).

Frontend local overrides: copy [frontend/.env.example](frontend/.env.example) to **`frontend/.env.local`** (`VITE_API_URL`, `VITE_ESP32_CAPTURE_URL`).

## Run locally (3 terminals)

Terminal 1 - Bin fill model service:
```powershell
cd services\fill-api
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8005
```
Listens on http://localhost:8005

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

Create one Railway project with separate services:

1. **fill-api** — root: `services/fill-api`; ensure `model/best.pt` is in repo (run `scripts/install_fill_model.ps1`).
2. **backend** — root: `backend`, start: `npm start`,
   set `MODEL_FILL_URL` to the **https://** public URL of the `fill-api` service.
   Also set `MODEL_WASTE_URL`, `MODEL_ANIMAL_URL` as needed.
3. **frontend** — root: `frontend`, build: `npm run build`, start: `npm run serve`, set `VITE_API_URL` to the **https://** public URL of `backend`.

Add Railway Postgres later when you wire users / history into the gateway.
