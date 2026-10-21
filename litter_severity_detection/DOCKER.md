# Litter Severity API — Docker

The **Dockerfile** for this component lives next to the FastAPI app:

`services/litter-severity-api/` (repository root, **not** inside `litter_severity_detection/`).

## Prerequisites

- **Docker Desktop** installed and **running** (Windows: the whale icon; Linux engine must be started). If you see `dockerDesktopLinuxEngine: The system cannot find the file specified`, start Docker Desktop first.

- **`model/best.pt`** inside `services/litter-severity-api/model/` (copy from `litter_severity_detection/models/best.pt` after training).

## Option A — from repository root `R26-IT-084`

```powershell
cd C:\Projects\R26-IT-084
docker compose -f docker-compose.litter.yml up --build
```

API: **http://localhost:8003/predict** (multipart field `file`), **http://localhost:8003/health**

## Option B — from `litter_severity_detection/` (component folder)

```powershell
cd C:\Projects\R26-IT-084\litter_severity_detection
docker compose up --build
```

Same ports: **8003 → 8000** in the container.

## Option C — plain Docker (no Compose)

The **`.`** at the end is required — it tells Docker to use the current folder as the build context (where the `Dockerfile` is).

```powershell
cd C:\Projects\R26-IT-084\services\litter-severity-api
docker build -t litter-api .
docker run --rm -p 8003:8000 -e PORT=8000 litter-api
```

## VisionWaste backend

In `backend/.env`, point litter inference at your deployed API or local Docker:

```env
# Hosted (default in repo .env.example):
MODEL_LITTER_URL=litter-severity-model-waste-classification.up.railway.app
# Local litter container:
# MODEL_LITTER_URL=http://localhost:8003
```

Then use the main app **Litter Severity** page (`/litter-severity`) or `POST /litter-severity` with field `image`.
