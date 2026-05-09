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
│   ├── auth.routes.js
│   ├── devices.routes.js
│   ├── geo.routes.js
│   ├── predict.routes.js
│   └── captures.routes.js
├── controllers/
│   ├── health.controller.js
│   ├── auth.controller.js
│   ├── devices.controller.js
│   ├── geo.controller.js
│   ├── predict.controller.js
│   ├── latest.controller.js
│   └── captures.controller.js
├── services/
│   ├── modelClient.js             talks to model microservices via HTTP
│   ├── captureService.js          DB persistence helpers (no-op when DB off)
│   ├── deviceService.js           devices + latest capture queries
│   └── latestState.js             in-memory latest snapshot per device
├── models/                        Sequelize models (DB schema)
│   ├── index.js                   defines associations
│   ├── User.js
│   ├── Device.js
│   ├── Capture.js
│   └── Prediction.js
├── middleware/
│   ├── upload.js                  multer (in-memory) for image uploads
│   ├── auth.js                    JWT guards + admin role
│   └── errorHandler.js            404 + central error handler
├── utils/
│   ├── fillLevel.js               derive Empty/Half/Overflow from YOLO preds
│   ├── geo.js                     Haversine distance helpers
│   └── publicUrl.js               Railway-safe public API base URL
├── package.json
├── .env / .env.example
└── README.md
```

## DB modes

The backend works both **with** and **without** a database:

- **Without `DATABASE_URL`** - persistence features are silently skipped.
  `/predict` still works; `/captures*` and `/devices*` return **503**.
- **With `DATABASE_URL`** - captures and predictions are saved per request.
  Set `DB_SYNC=true` (dev only) to auto-create tables on startup.

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | / | API discovery JSON |
| GET | /health | Gateway + model + DB |
| POST | /auth/register | JSON `{ name, email, password, adminInvite? }` — optional invite creates admin |
| POST | /auth/login | JSON `{ email, password }` → JWT |
| POST | /predict | multipart `image`, optional `esp32_id` / `device_id`, `model`, `conf` |
| GET | /captures | Query pagination |
| GET | /captures/:id | Capture metadata + predictions (image blob omitted) |
| GET | /devices | All bins |
| GET | /devices/map | Bins with coordinates + latest fill + image URL |
| GET | /devices/nearest | Query `lat`, `lng`, `limit` |
| GET | /devices/:id | Bin metadata |
| GET | /devices/:id/latest | Latest snapshot JSON (+ predictions + signed URL style image link) |
| GET | /devices/:id/image/latest | Raw JPEG bytes (DB or in-memory fallback) |
| POST | /devices | **Admin JWT** — create bin |
| PATCH | /devices/:id | **Admin JWT** — update bin |
| GET | /geo/search?q= | Nominatim proxy for admin UI |

## Railway Postgres (first deploy)

1. Add **PostgreSQL** plugin to your Railway project.
2. On **backend** service → Variables → add **`DATABASE_URL`** (reference from Postgres plugin).
3. Set **`DB_SYNC=true`** for the **first** deploy to create tables; then set **`DB_SYNC=false`** for normal operation.
4. Set **`JWT_SECRET`** to a long random string (required for `/auth/*`).
5. Optional: **`ADMIN_INVITE_SECRET`** — share this code once so a teammate can `POST /auth/register` with `"adminInvite"` and receive role `admin`.
6. Set **`CORS_ORIGIN`** to your frontend Railway URL (and `http://localhost:3000` for dev).

`POST /predict` adds a response header `X-Capture-Id` whenever the row was saved.

## Database schema (Sequelize)

| Table | Key columns |
|-------|-------------|
| users | id, name, email, password_hash, role (`user` \| `admin`), timestamps |
| devices | id, user_id, name, esp32_id (unique), location, address, latitude, longitude, timestamps |
| captures | id, user_id, device_id, image_url, image_buffer, image_mimetype, fill_level, model_name, captured_at, timestamps |
| predictions | id, capture_id, label, confidence, box_x1..box_y2, timestamps |

Associations:

- User 1—N Device, User 1—N Capture
- Device 1—N Capture
- Capture 1—N Prediction (cascade delete)

Index on `(device_id, captured_at)` for latest-per-bin queries.

## Environment variables

See `.env.example`:

| Variable | Default | Notes |
|----------|---------|-------|
| `MODEL_YOLO_URL` | `http://localhost:6000` | Model microservice base URL; `https://` added automatically if you omit the scheme (except localhost). Use full Railway URLs in production |
| `CORS_ORIGIN` | (empty) | Comma-separated allowed frontend origins; empty keeps permissive CORS |
| `JWT_SECRET` | (empty) | Required for auth routes (min 8 chars recommended) |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry passed to `jsonwebtoken` |
| `ADMIN_INVITE_SECRET` | (empty) | Optional invite code for admin registration |
| `DEFAULT_MODEL` | `yolo` | Default model when client doesn't pick one |
| `INFER_TIMEOUT_SECONDS` | `60` | Max wait per model inference |
| `MAX_UPLOAD_MB` | `25` | Max upload size |
| `PORT` | `5000` | Listening port (Railway sets this automatically) |
| `DATABASE_URL` | (empty) | Postgres connection string (Railway plugin) |
| `DB_SYNC` | `false` | Auto-create tables on boot (dev / first deploy only) |
| `DB_SYNC_ALTER` | `false` | If syncing, also alter columns to match models |
| `DB_LOGGING` | `false` | Echo SQL to stdout |

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
  - `MODEL_YOLO_URL` → public URL of the deployed model service
  - `DATABASE_URL` → referenced from Railway Postgres plugin
  - `JWT_SECRET` → random secret string
  - `DB_SYNC=true` only on first deploy to create tables; turn off afterwards
  - `CORS_ORIGIN` → your frontend URL(s)
- Railway auto-detects Node and runs `npm install`.
