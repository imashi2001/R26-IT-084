"""Animal detection micro-service (Railway).

Single-purpose FastAPI app wrapping a YOLOv8 model loaded from
``model/best.pt``. Exposes ``POST /predict`` returning detections plus a
base64 annotated JPEG.
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

MODEL_PATH = os.environ.get("ANIMAL_MODEL_PATH", "model/best.pt")
IMGSZ = int(os.environ.get("ANIMAL_IMGSZ", "416"))
CONF = float(os.environ.get("ANIMAL_CONF", "0.25"))


@lru_cache(maxsize=1)
def _load_model():
    from ultralytics import YOLO

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Animal model not found at '{MODEL_PATH}'. "
            "Set ANIMAL_MODEL_PATH or place best.pt in services/animal-api/model/."
        )
    return YOLO(MODEL_PATH)


app = FastAPI(title="Animal Detection API", version="1.0.0")

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
        "service": "animal-detection",
        "model_path": MODEL_PATH,
        "endpoints": ["GET /health", "POST /predict"],
        "classes": ["cat", "crow", "dog", "monkey"],
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
    return {"ok": ok, "model_path": MODEL_PATH, "error": err}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")

    model = _load_model()
    # Pass the PIL image directly so Ultralytics applies its RGB->BGR
    # conversion. Passing a raw numpy array would skip that step.
    results = model.predict(source=pil, imgsz=IMGSZ, conf=CONF, verbose=False)
    r = results[0]

    detections: list[dict[str, Any]] = []
    if r.boxes is not None and len(r.boxes):
        for b in r.boxes:
            cls_id = int(b.cls[0])
            conf = float(b.conf[0])
            xyxy = [float(x) for x in b.xyxy[0].tolist()]
            name = r.names.get(cls_id, str(cls_id))
            detections.append(
                {
                    "class_id": cls_id,
                    "class_name": name,
                    "confidence": conf,
                    "box_xyxy": xyxy,
                }
            )

    plot_bgr = r.plot()
    rgb = plot_bgr[:, :, ::-1]
    out_buf = io.BytesIO()
    Image.fromarray(rgb).save(out_buf, format="JPEG", quality=88)
    img_b64 = base64.standard_b64encode(out_buf.getvalue()).decode("ascii")

    return {
        "model": "animal_detection",
        "detections": detections,
        "detection_count": len(detections),
        "annotated_image_base64": img_b64,
        "image_size": {"width": pil.width, "height": pil.height},
        "inference_imgsz": IMGSZ,
        "conf_threshold": CONF,
    }
