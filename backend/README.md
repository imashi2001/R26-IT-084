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
| POST | /predict | multipart `image`, **`bridge_instance_id`** (ESP32 bridge), optional **`esp32_id`** / **`device_id`**, optional **`source_type`** (`esp32` \| `mobile` \| `admin`), **`lat`** / **`lon`** (weather + stored on capture when DB enabled), optional **`model`**, **`conf`** |
| GET | /captures | Query `limit`, `offset`, optional **`device_id`** |
| GET | /captures/:id | Capture metadata + predictions (`has_image` when JPEG stored; image blob omitted) |
| GET | /captures/:id/image | Raw JPEG bytes for that capture row |
| GET | /alerts | **JWT** — list alerts (auto-sync from recent captures); query **`status`** (`open` \| `acknowledged` \| `actioned` \| `rejected` \| `dismissed` \| `all`), **`limit`**, **`offset`** |
| PATCH | /alerts/:id | **Admin JWT** — JSON **`{ status, admin_note? }`** to update workflow + audit note |
| GET | /devices | All bins; add **`?latest=1`** for each bin’s resolved **`latest_fill_level`** / **`latest_fill_percentage`** (for dashboards without map coords) |
| GET | /devices/map | Bins with coordinates + latest fill + image URL + latest source / fill % |
| GET | /devices/nearest | Query `lat`, `lng`, `limit` |
| GET | /devices/:id | Bin metadata |
| GET | /devices/:id/latest | Latest snapshot JSON (+ predictions + image link) |
| GET | /devices/:id/captures | Paginated capture history for the bin (`limit`, `offset`) |
| GET | /devices/:id/image/latest | Raw JPEG bytes (DB or in-memory fallback) |
| POST | /devices | **Admin JWT** — create bin |
| PATCH | /devices/:id | **Admin JWT** — update bin |
| GET | /geo/search?q= | Nominatim proxy for admin UI |
| GET | /api/waste-data | Query **`date`=`YYYY-MM-DD`** — holiday/long-weekend adjusted demo levels (`backend/holiday_cache.json`); **`geocode_cache`** in JSON mirrors **`backend/geocode_cache.json`** |
| POST | /litter-severity | multipart **`image`** — proxies to litter microservice (**`MODEL_LITTER_URL`**); returns LSI, severity, detections, optional annotated JPEG |

**`POST /predict` response — `animal`:** Each item in **`detections`** includes **`label`**, **`confidence`**, and **`box`** `[x1,y1,x2,y2]` (the gateway normalizes **`box_xyxy`** / **`class_name`** from the animal microservice). **`annotated_image_base64`** is a JPEG with bounding boxes rendered server-side (YOLO plot).

**`POST /predict` response — `bin_fill`:** Present when **`MODEL_YOLO_URL`** is set on the gateway (optional Flask **`model-yolo`** service). Same JSON shape as the bin-fill microservice: **`predictions`** / **`detections`**, optional **`annotated_image_base64`**. Top-level **`bin_fill_level`** is **`Empty`** \| **`Half`** \| **`Overflow`** when at least one prediction has label **`empty`** \| **`half`** \| **`overflow`** (case-insensitive); otherwise **`null`**.

## Railway Postgres (first deploy)

1. Add **PostgreSQL** plugin to your Railway project.
2. On **backend** service → Variables → add **`DATABASE_URL`** (reference from Postgres plugin).
3. Set **`DB_SYNC=true`** for the **first** deploy to create tables; then set **`DB_SYNC=false`** for normal operation.
4. Set **`JWT_SECRET`** to a long random string (required for `/auth/*`).
5. Optional: **`ADMIN_INVITE_SECRET`** — share this code once so a teammate can `POST /auth/register` with `"adminInvite"` and receive role `admin`.
6. Set **`CORS_ORIGIN`** to your frontend Railway URL (and `http://localhost:3000` for dev).

`POST /predict` adds a response header `X-Capture-Id` whenever the row was saved.

After adding columns in production, set **`DB_SYNC=true`** and **`DB_SYNC_ALTER=true`** for **one** redeploy (sync runs only when `DB_SYNC` is on). Confirm logs show `[db] tables synced (alter=true)`, then set **`DB_SYNC=false`** and **`DB_SYNC_ALTER=false`** again.

---

### Bridge ↔ bin binding

- **`POST /predict`** should include **`bridge_instance_id`** (VisionWaste laptop bridge) for ESP32-origin uploads.
- If **`devices.bridge_instance_id`** is **null**, matching is by **`esp32_id`** (and **`device_id`** when sent).
- If **`devices.bridge_instance_id`** is **set**, **`device_id`** is attached when the incoming **`bridge_instance_id`** matches **or** when the client sets **`source_type`** to **`mobile`** or **`admin`** and sends a valid **`device_id`** (phone / trusted tooling).

### Mobile camera upload (`source_type=mobile`)

Multipart fields typical for the React **`/mobile-report`** flow:

- **`image`** (required) — JPEG/PNG file  
- **`device_id`** — target bin id  
- **`source_type`** = `mobile`  
- **`lat`**, **`lon`** — optional capture GPS (also used for weather)  
- Omit **`bridge_instance_id`** when reporting from a phone (unless you intentionally emulate the laptop bridge).

---

## Database schema (Sequelize)

| Table | Key columns |
|-------|-------------|
| users | id, name, email, password_hash, role (`user` \| `admin`), timestamps |
| devices | id, user_id, **name** (display “Bin name”), **esp32_id** (unique), **location** (“Location name”), address, latitude, longitude, **status** (`active` \| `inactive` \| `maintenance`), **bridge_instance_id** (optional laptop binding), **camera_base_url**, **pending_speaker_action**, **pending_speaker_at**, timestamps |
| captures | id, user_id, device_id, **bridge_instance_id**, image_url, image_buffer, image_mimetype, fill_level, model_name, captured_at, **source_type**, **latitude**, **longitude**, **fill_percentage**, **prediction_class**, waste_*, risk_*, weather fields, timestamps |
| predictions | id, capture_id, label, confidence, box_x1..box_y2, timestamps |

Associations:

- User 1—N Device, User 1—N Capture
- Device 1—N Capture
- Capture 1—N Prediction (cascade delete)

Index on `(device_id, captured_at)` for latest-per-bin queries.

Appendix — additive columns if you manage schema manually (Postgres):

```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status VARCHAR(255) DEFAULT 'active';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS camera_base_url VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_speaker_action VARCHAR(16);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_speaker_at TIMESTAMPTZ;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS source_type VARCHAR(16);
ALTER TABLE captures ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS fill_percentage DOUBLE PRECISION;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS prediction_class VARCHAR(160);
```

(Adjust lengths/types to match `backend/models`. Use **`DB_SYNC=true`** + **`DB_SYNC_ALTER=true`** once on Railway instead if preferred.)

---

## Environment variables

See `.env.example`:

| Variable | Default | Notes |
|----------|---------|-------|
| `MODEL_WASTE_URL` | `http://localhost:8001` | Waste classifier microservice; scheme added if omitted (except localhost) |
| `MODEL_ANIMAL_URL` | `http://localhost:8002` | Animal / detection microservice |
| `MODEL_YOLO_URL` | (empty) | Optional **`model-yolo`** bin-fill service (`POST /infer`, multipart **`image`**). When empty, **`bin_fill`** is omitted from **`inferAll`** |
| `MODEL_LITTER_URL` | (empty) | Optional **`litter-severity-api`** (`POST /predict`, multipart **`file`** via gateway **`POST /litter-severity`** with **`image`**) |
| `CORS_ORIGIN` | (empty) | Comma-separated allowed frontend origins; empty keeps permissive CORS |
| `JWT_SECRET` | (empty) | Required for auth routes (min 8 chars recommended) |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry passed to `jsonwebtoken` |
| `ADMIN_INVITE_SECRET` | (empty) | Optional invite code for admin registration |
| `DEFAULT_MODEL` | `waste` | Default when client picks a single model |
| `INFER_TIMEOUT_SECONDS` | `60` | Max wait per model inference |
| `MAX_UPLOAD_MB` | `25` | Max upload size |
| `PORT` | `5000` | Listening port (Railway sets this automatically) |
| `DATABASE_URL` | (empty) | Postgres connection string (Railway plugin) |
| `DB_SYNC` | `false` | Auto-create tables on boot (dev / first deploy only) |
| `DB_SYNC_ALTER` | `false` | If syncing, also alter columns to match models |
| `DB_LOGGING` | `false` | Echo SQL to stdout |
| `OPENWEATHER_API_KEY` | (empty) | Optional real weather; stub otherwise |

---

## Run locally

```powershell
cd backend
npm install
npm start
```

Start the **waste** and **animal** FastAPI services (see repo `services/waste-api` and `services/animal-api`), optional **`model-yolo`** Flask service for bin fill, or point **`MODEL_*_URL`** variables at deployed URLs.

## Deploy on Railway

- Root directory: `backend`
- Start command: `npm start`
- Variables:
  - **`MODEL_WASTE_URL`**, **`MODEL_ANIMAL_URL`**, optional **`MODEL_YOLO_URL`**, optional **`MODEL_LITTER_URL`** → public URLs of the deployed model services
  - `DATABASE_URL` → referenced from Railway Postgres plugin
  - `JWT_SECRET` → random secret string
  - `DB_SYNC=true` only on first deploy to create tables; turn off afterwards
  - **`OPENWEATHER_API_KEY`** (optional)
  - `CORS_ORIGIN` → your frontend URL(s)
- Railway auto-detects Node and runs `npm install`.
