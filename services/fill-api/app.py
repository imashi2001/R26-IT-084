"""Bin fill-level detection micro-service (Railway).

FastAPI wrapper around the trained YOLOv8n model
(garbage_fill_level_detection_v1) loaded from ``model/best.pt``.

Classes: empty | half | overflow
"""

from __future__ import annotations

import base64
import io
import os
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

MODEL_PATH = os.environ.get("FILL_MODEL_PATH", "model/best.pt")
IMGSZ = int(os.environ.get("FILL_IMGSZ", "640"))
CONF = float(os.environ.get("FILL_CONF", "0.25"))


def _normalize_label(name: str) -> str:
    return name.strip().lower()


@lru_cache(maxsize=1)
def _load_model():
    from ultralytics import YOLO

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Fill-level model not found at '{MODEL_PATH}'. "
            "Copy garbage_fill_level_detection_v1/weights/best.pt to "
            "services/fill-api/model/best.pt or set FILL_MODEL_PATH."
        )
    return YOLO(MODEL_PATH)


app = FastAPI(title="Bin Fill Level API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warmup() -> None:
    try:
        _load_model()
    except Exception:
        pass


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "bin-fill-level",
        "model": "garbage_fill_level_detection_v1",
        "model_path": MODEL_PATH,
        "endpoints": ["GET /health", "POST /predict"],
        "classes": ["empty", "half", "overflow"],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    ok = False
    err = None
    try:
        _ = _load_model()
        ok = True
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
    return {"ok": ok, "model_loaded": ok, "model_path": MODEL_PATH, "error": err}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")

    model = _load_model()
    results = model.predict(source=pil, imgsz=IMGSZ, conf=CONF, verbose=False)
    r = results[0]

    predictions: list[dict[str, Any]] = []
    if r.boxes is not None and len(r.boxes):
        for b in r.boxes:
            cls_id = int(b.cls[0])
            conf = float(b.conf[0])
            xyxy = [round(float(x), 2) for x in b.xyxy[0].tolist()]
            raw_name = r.names.get(cls_id, str(cls_id))
            label = _normalize_label(str(raw_name))
            predictions.append(
                {
                    "class_id": cls_id,
                    "class_name": str(raw_name),
                    "label": label,
                    "confidence": round(conf, 4),
                    "box": xyxy,
                }
            )

    plot_bgr = r.plot()
    rgb = plot_bgr[:, :, ::-1]
    out_buf = io.BytesIO()
    Image.fromarray(rgb).save(out_buf, format="JPEG", quality=90)
    img_b64 = base64.standard_b64encode(out_buf.getvalue()).decode("ascii")

    return {
        "model": "garbage_fill_level_detection_v1",
        "predictions": predictions,
        "detections": predictions,
        "detection_count": len(predictions),
        "annotated_image_base64": img_b64,
        "image_size": {"width": pil.width, "height": pil.height},
        "inference_imgsz": IMGSZ,
        "conf_threshold": CONF,
    }
