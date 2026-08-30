# model-yolo (DEPRECATED)

**This Flask service is replaced by `services/fill-api`.**

Use the new FastAPI bin-fill service with your trained
`garbage_fill_level_detection_v1` weights instead.

## Migration

| Old | New |
|-----|-----|
| Root: `model-yolo` | Root: `services/fill-api` |
| `POST /infer` field `image` | `POST /predict` field `file` |
| Backend `MODEL_YOLO_URL` | Backend `MODEL_FILL_URL` |

See [services/fill-api/README.md](../services/fill-api/README.md).

---

<details>
<summary>Legacy docs (model-yolo)</summary>

Standalone Flask service that runs the trained YOLOv8 model.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/health` | - | `{ status, service, model, weights }` |
| POST | `/infer` | multipart `image` | `{ model, predictions }` |

Default port: `6000`.

</details>
