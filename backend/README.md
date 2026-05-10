# backend (API gateway, Express.js)

Node.js / Express service that exposes the public API used by the frontend.

It is **stateless about ML**: it forwards image requests to two separately
deployed FastAPI microservices (`services/waste-api` and `services/animal-api`)
and returns a unified response. On top of that it adds **rule-based**
hygienic-risk + rotting-time + forecasting logic (no ML), and optionally
persists each capture to Postgres via Sequelize.

This is intentionally aligned with the `test` branch's backend layout so the
two branches can be merged cleanly.

## Folder structure

```
backend/
├── server.js                      app bootstrap (DB connect, then listen)
├── app.js                         express app config + routes + error handlers
├── config/
│   ├── env.js                     reads .env, exposes typed config (incl. two model URLs)
│   └── db.js                      Sequelize connection (optional)
├── routes/
│   ├── index.js                   mounts feature routers
│   ├── health.routes.js
│   ├── auth.routes.js
│   ├── devices.routes.js
│   ├── geo.routes.js
│   ├── predict.routes.js
│   ├── captures.routes.js
│   ├── latest.routes.js
│   └── forecast.routes.js         <-- additive (rule-based forecast)
├── controllers/
│   ├── health.controller.js
│   ├── auth.controller.js
│   ├── devices.controller.js
│   ├── geo.controller.js
│   ├── predict.controller.js      <-- calls BOTH waste + animal, runs risk engine
│   ├── latest.controller.js
│   ├── captures.controller.js
│   └── forecast.controller.js     <-- additive
├── services/
│   ├── modelClient.js             talks to waste-api + animal-api over HTTP
│   ├── captureService.js          DB persistence helpers (no-op when DB off)
│   ├── deviceService.js           devices + latest capture queries
│   ├── latestState.js             in-memory latest snapshot per device
│   ├── weatherService.js          <-- additive (OpenWeather + stub)
│   ├── riskEngine.js              <-- additive (rule-based risk + rotting)
│   └── forecastService.js         <-- additive (replays risk over forecast slots)
├── models/                        Sequelize models (DB schema)
│   ├── index.js                   defines associations
│   ├── User.js
│   ├── Device.js
│   ├── Capture.js                 base columns + extras (waste/animal/risk/weather)
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
| GET | /health | Gateway + both model services + DB |
| POST | /auth/register | JSON `{ name, email, password, adminInvite? }` |
| POST | /auth/login | JSON `{ email, password }` → JWT |
| POST | /predict | multipart `image`, `bridge_instance_id`, optional `esp32_id` / `device_id`, `model=waste\|animal`, `lat`, `lon`. Calls BOTH models by default and returns waste + animal + weather + risk + rotting in one payload |
| GET | /forecast?lat=&lon=&hours=24 | Risk timeline at default coords (or override) |
| GET | /forecast/:deviceId?hours=24 | Risk timeline for a specific bin |
| GET | /captures | Query pagination |
| GET | /captures/:id | Capture metadata + predictions (image blob omitted) |
| GET | /devices | All bins |
| GET | /devices/map | Bins with coordinates + latest fill + image URL |
| GET | /devices/nearest | Query `lat`, `lng`, `limit` |
| GET | /devices/:id | Bin metadata |
| GET | /devices/:id/latest | Latest snapshot JSON (predictions + extras + image link) |
| GET | /devices/:id/image/latest | Raw JPEG bytes (DB or in-memory fallback) |
| POST | /devices | **Admin JWT** — create bin |
| PATCH | /devices/:id | **Admin JWT** — update bin |
| GET | /geo/search?q= | Nominatim proxy for admin UI |
| GET | /latest, /latest/image | Legacy single-bin demo helpers |

`POST /predict` adds a response header `X-Capture-Id` whenever the row was saved.

## Two model microservices

Unlike the `test` branch (which uses one `model-yolo` service), this component
uses **two separately deployed services** on Railway:

- **`services/waste-api`** — MobileNetV2 binary classifier (organic / non-organic).
- **`services/animal-api`** — YOLOv8n detector (dog / cat / monkey / crow).

Both expose `POST /predict` with multipart field name `file` and `GET /health`.
Set their public Railway URLs as `MODEL_WASTE_URL` and `MODEL_ANIMAL_URL` on
this backend.

## Risk + rotting + forecast (rule-based, no ML)

`services/riskEngine.js` implements the project's case-based rules:

- **CASE 3 (HIGH)** — organic + animals
- **CASE 2 (MEDIUM)** — organic + high temp AND high humidity
- **CASE 1 (LOW)** — organic, no animals, normal weather
- **EXTRA HIGH** — non-organic + animals
- **EXTRA LOW** — non-organic, no animals
- **CASE 4 (CRITICAL)** — deferred (current waste model is binary, can't infer "mixed")

`services/forecastService.js` replays the same engine over OpenWeather's
5-day / 3-hour forecast slots so the dashboard can show a 24h risk timeline.

## Run locally

```powershell
cd backend
npm install
npm start
```

Both model microservices need to be running too (`services/waste-api` and
`services/animal-api`) — or set their URLs to your Railway deployments.

## Deploy on Railway

- Root directory: `backend`
- Start command: `npm start`
- Variables:
  - `MODEL_WASTE_URL` → public URL of the deployed `services/waste-api`
  - `MODEL_ANIMAL_URL` → public URL of the deployed `services/animal-api`
  - `DATABASE_URL` → referenced from Railway Postgres plugin
  - `JWT_SECRET` → random secret string
  - `DB_SYNC=true` only on first deploy to create tables; turn off afterwards
  - `CORS_ORIGIN` → your frontend URL(s)
  - `OPENWEATHER_API_KEY` → optional, for live weather/forecast

Railway auto-detects Node and runs `npm install`.
