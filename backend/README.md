# backend (API gateway, Express.js)

Node.js / Express service that exposes the public API used by the frontend.

It is **stateless about ML**: it forwards image requests to one of the model
microservices (e.g. `model-yolo`) and returns a unified response. It also
optionally persists each capture (and its predictions) to Postgres via Sequelize.

## Folder structure

```
backend/
├── server.js                      app bootstrap (DB connect, then listen)
├── app.js                         express app config + routes + error handlers
├── config/
│   ├── env.js                     reads .env, exposes typed config
│   └── db.js                      Sequelize connection (optional)
├── routes/
│   ├── index.js                   mounts feature routers
│   ├── health.routes.js
│   ├── predict.routes.js
│   └── captures.routes.js
├── controllers/
│   ├── health.controller.js
│   ├── predict.controller.js
│   └── captures.controller.js
├── services/
│   ├── modelClient.js             talks to model microservices via HTTP
│   └── captureService.js          DB persistence helpers (no-op when DB off)
├── models/                        Sequelize models (DB schema)
│   ├── index.js                   defines associations
│   ├── User.js
│   ├── Device.js
│   ├── Capture.js
│   └── Prediction.js
├── middleware/
│   ├── upload.js                  multer (in-memory) for image uploads
│   └── errorHandler.js            404 + central error handler
├── utils/                         (place shared helpers here)
├── package.json
├── .env / .env.example
└── README.md
```

## DB modes

The backend works both **with** and **without** a database:

- **Without `DATABASE_URL`** - persistence features are silently skipped.
  `/predict` still works; `/captures*` returns 503.
- **With `DATABASE_URL`** - captures and predictions are saved per request.
  Set `DB_SYNC=true` (dev only) to auto-create tables on startup.

## Endpoints

| Method | Path             | Body / Query                                | Returns                                     |
|--------|------------------|---------------------------------------------|---------------------------------------------|
| GET    | /                | -                                           | small JSON map of service routes            |
| GET    | /health          | -                                           | gateway + models + database health          |
| POST   | /predict         | multipart `image`, optional `model`, `conf` | `[{label, confidence, box}, ...]`           |
| GET    | /captures        | `?limit=20&offset=0`                        | `{ count, limit, offset, captures: [...] }` |
| GET    | /captures/:id    | -                                           | `{ ...capture, predictions: [...] }`        |

`POST /predict` adds a response header `X-Capture-Id` whenever the row was saved.

## Database schema (Sequelize)

| Table         | Key columns                                                                          |
|---------------|--------------------------------------------------------------------------------------|
| users         | id, name, email, password_hash, role, timestamps                                     |
| devices       | id, user_id, name, esp32_id (unique), location, timestamps                           |
| captures      | id, user_id, device_id, image_url, model_name, captured_at, timestamps               |
| predictions   | id, capture_id, label, confidence, box_x1..box_y2, timestamps                        |

Associations:
- User 1—N Device, User 1—N Capture
- Device 1—N Capture
- Capture 1—N Prediction (cascade delete)

## Environment variables

See `.env.example`:

| Variable                | Default                  | Notes                                              |
|-------------------------|--------------------------|----------------------------------------------------|
| `MODEL_YOLO_URL`        | `http://localhost:6000`  | Model microservice base URL; `https://` added automatically if you omit the scheme (except localhost). Use full Railway URLs in production |
| `CORS_ORIGIN`           | (empty)                  | Comma-separated allowed frontend origins; empty keeps permissive CORS |
| `DEFAULT_MODEL`         | `yolo`                   | Default model when client doesn't pick one         |
| `INFER_TIMEOUT_SECONDS` | `60`                     | Max wait per model inference                       |
| `MAX_UPLOAD_MB`         | `25`                     | Max upload size                                    |
| `PORT`                  | `5000`                   | Listening port (Railway sets this automatically)   |
| `DATABASE_URL`          | (empty)                  | Postgres connection string (Railway plugin)        |
| `DB_SYNC`               | `false`                  | Auto-create tables on boot (dev only)              |
| `DB_SYNC_ALTER`         | `false`                  | If syncing, also alter columns to match models     |
| `DB_LOGGING`            | `false`                  | Echo SQL to stdout                                 |

## Run locally

```powershell
cd backend
npm install
npm start
```

The model service must already be running (`../model-yolo/`).

## Deploy on Railway

- Root directory: `backend`
- Start command: `npm start`
- Variables:
  - `MODEL_YOLO_URL` -> public URL of the deployed model service
  - `DATABASE_URL` -> referenced from Railway Postgres plugin
  - `DB_SYNC=true` (only on first deploy to create tables; turn off afterwards)
- Railway auto-detects Node and runs `npm install`.
