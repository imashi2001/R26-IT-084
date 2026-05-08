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
```

The frontend talks **only** to `backend`.
`backend` talks **only** to model microservices over HTTP.
Each model is a separate process so model dependencies (torch, ultralytics, etc.)
never leak into the gateway and other team members' models.

```
Frontend (3000)
   |  fetch /predict
   v
Backend gateway (5000) -- Express.js
   |  POST /infer  (multipart image)
   v
model-yolo service (6000) -- Python  (best.pt lives here)
```

When new models are added, deploy them as additional services
(e.g. `model-binlevel/`) and register their URL in the backend's
`MODEL_REGISTRY` (`backend/server.js`).

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
(create one based on `.env.example`).

Terminal 3 - Frontend:
```powershell
cd frontend
npm install
npm start
```
Open http://localhost:3000.

## Deploy on Railway

Create one Railway project with three services:

1. **model-yolo** - root: `model-yolo`, start: `gunicorn server:app -b 0.0.0.0:$PORT --timeout 120`
2. **backend** - root: `backend`, start: `npm start`,
   set `MODEL_YOLO_URL` to the public URL of the `model-yolo` service.
3. **frontend** - root: `frontend`, build: `npm run build`, set `REACT_APP_API_URL` to the public URL of `backend`.

Add Railway Postgres later when you wire users / history into the gateway.
