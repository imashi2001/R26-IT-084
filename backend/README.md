# backend (API gateway, Express.js)

Node.js / Express service that exposes the public API used by the frontend.

This service is **stateless about ML**: it forwards image requests to one of
the model microservices (e.g. `model-yolo`) and returns a unified response.

## Endpoints

| Method | Path     | Body                                         | Returns                                    |
|--------|----------|----------------------------------------------|--------------------------------------------|
| GET    | /health  | -                                            | gateway status + each model's reachability |
| POST   | /predict | multipart `image`, optional `model`, `conf`  | `[{label, confidence, box}, ...]`          |

`model` defaults to `DEFAULT_MODEL` (currently `yolo`).

## Environment variables

See `.env.example`:

- `MODEL_YOLO_URL` - URL of the YOLO model service (e.g. `http://localhost:6000`)
- `DEFAULT_MODEL` - model name to use when the client does not specify one
- `INFER_TIMEOUT_SECONDS` - max time to wait for a model service response
- `PORT` - port the gateway listens on

Create your own `.env` (it's gitignored):

```text
MODEL_YOLO_URL=http://localhost:6000
DEFAULT_MODEL=yolo
INFER_TIMEOUT_SECONDS=60
PORT=5000
```

## Run locally

```powershell
cd backend
npm install
npm start
```

The model service must already be running (see `../model-yolo/README.md`).

## Deploy on Railway

- Root directory: `backend`
- Start command: `npm start` (i.e. `node server.js`)
- Variables: set `MODEL_YOLO_URL` to the deployed model service's public URL.
- Railway will auto-detect Node and run `npm install`.
