"""Littering-event detection micro-service (Ultralytics YOLO11).

Frame-level detector for a person/action visually identified as throwing or
leaving garbage around a bin. Not the litter-severity / LSI object detector.

Endpoints:
  GET  /health
  POST /predict  (multipart ``file``)
"""

from __future__ import annotations

import base64
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
MODEL_PATH = Path(
    os.environ.get("LITTERING_MODEL_PATH", str(ROOT / "weights" / "best.pt"))
)
DEFAULT_CONF = float(os.environ.get("LITTERING_CONFIDENCE", "0.50"))
DEFAULT_IOU = float(os.environ.get("LITTERING_IOU", "0.45"))
DEFAULT_MAX_DET = int(os.environ.get("LITTERING_MAX_DETECTIONS", "100"))
DEFAULT_DEVICE = os.environ.get("LITTERING_DEVICE", "cpu").strip() or "cpu"
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "25")) * 1024 * 1024

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_PREFIX = "image/"


def _resolve_device(requested: Optional[str]) -> str:
    raw = (requested or DEFAULT_DEVICE or "cpu").strip().lower()
    if raw in ("cuda", "gpu", "0"):
        try:
            import torch

            if torch.cuda.is_available():
                return "0"
        except Exception:
            pass
        return "cpu"
    return "cpu"


def _class_names(model: YOLO) -> Dict[int, str]:
    names = model.names
    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}
    if isinstance(names, (list, tuple)):
        return {i: str(v) for i, v in enumerate(names)}
    return {}


@lru_cache(maxsize=1)
def _load_model() -> YOLO:
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Littering model not found at '{MODEL_PATH}'. "
            "Place best.pt in weights/ or set LITTERING_MODEL_PATH."
        )
    return YOLO(str(MODEL_PATH))


app = FastAPI(title="Littering Action API", version="1.0.0")
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
        "service": "littering-action",
        "model_path": str(MODEL_PATH),
        "endpoints": ["GET /health", "POST /predict"],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    model_loaded = False
    err: Optional[str] = None
    task: Optional[str] = None
    class_names: list[str] = []
    device = _resolve_device(None)

    try:
        model = _load_model()
        model_loaded = True
        task = str(getattr(model, "task", None) or "detect")
        names_map = _class_names(model)
        class_names = [names_map[i] for i in sorted(names_map)]
    except Exception as e:
        err = f"{type(e).__name__}: {e}"

    return {
        "status": "ok" if model_loaded else "degraded",
        "ok": model_loaded,
        "model_loaded": model_loaded,
        "model_path": str(MODEL_PATH),
        "model_filename": MODEL_PATH.name,
        "task": task,
        "class_names": class_names,
        "device": device,
        "error": err,
    }


def _validate_upload(file: UploadFile, raw: bytes) -> None:
    if not raw:
        raise HTTPException(400, "Empty image upload.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"Image too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")

    ext = Path(file.filename or "").suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file extension. Use JPEG or PNG.")

    ctype = (file.content_type or "").lower()
    if ctype and not ctype.startswith(ALLOWED_MIME_PREFIX):
        raise HTTPException(400, "Unsupported content type. Upload JPEG or PNG.")


def _encode_annotated_jpeg(bgr: np.ndarray, boxes, confs, clss, names: Dict[int, str]) -> str:
    out = bgr.copy()
    color = (0, 140, 255)
    for i in range(boxes.shape[0]):
        x1, y1, x2, y2 = map(int, boxes[i].tolist())
        conf = float(confs[i])
        cls_id = int(clss[i])
        label = names.get(cls_id, str(cls_id))
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        caption = f"{label} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(out, (x1, max(0, y1 - th - 6)), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            out,
            caption,
            (x1 + 2, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    ok, buf = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    if not ok:
        raise HTTPException(500, "Failed to encode annotated preview.")
    return base64.standard_b64encode(buf.tobytes()).decode("ascii")


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    confidence: Optional[float] = Form(None),
    iou: Optional[float] = Form(None),
    device_id: Optional[str] = Form(None),
    capture_id: Optional[str] = Form(None),
    include_annotated_image: Optional[str] = Form(None),
) -> dict[str, Any]:
    if file is None:
        raise HTTPException(400, "Missing image file. Send multipart field `file`.")

    raw = await file.read()
    _validate_upload(file, raw)

    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(400, "Could not decode image.")

    H, W = bgr.shape[:2]
    if H < 1 or W < 1:
        raise HTTPException(400, "Invalid image dimensions.")

    conf_thr = float(confidence) if confidence is not None else DEFAULT_CONF
    iou_thr = float(iou) if iou is not None else DEFAULT_IOU
    device = _resolve_device(None)

    try:
        model = _load_model()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e

    t0 = time.perf_counter()
    results = model.predict(
        source=bgr,
        conf=conf_thr,
        iou=iou_thr,
        max_det=DEFAULT_MAX_DET,
        device=device,
        verbose=False,
    )
    inference_ms = int((time.perf_counter() - t0) * 1000)

    res = results[0]
    names = _class_names(model)
    task = str(getattr(model, "task", None) or "detect")
    class_name_list = [names[i] for i in sorted(names)]

    boxes = res.boxes
    if boxes is None or len(boxes) == 0:
        xyxy = np.zeros((0, 4), dtype=np.float64)
        confs = np.zeros((0,), dtype=np.float64)
        clss = np.zeros((0,), dtype=np.int64)
    else:
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(np.int64)

    detections: List[dict[str, Any]] = []
    for i in range(xyxy.shape[0]):
        x1, y1, x2, y2 = [float(v) for v in xyxy[i].tolist()]
        detections.append(
            {
                "class_id": int(clss[i]),
                "class_name": names.get(int(clss[i]), str(int(clss[i]))),
                "confidence": float(confs[i]),
                "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "bbox_normalized": {
                    "x1": round(x1 / W, 4),
                    "y1": round(y1 / H, 4),
                    "x2": round(x2 / W, 4),
                    "y2": round(y2 / H, 4),
                },
            }
        )

    max_conf = float(np.max(confs)) if confs.size else 0.0
    want_annotated = str(include_annotated_image or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )

    payload: dict[str, Any] = {
        "success": True,
        "event_detected": len(detections) > 0,
        "event_count": len(detections),
        "max_confidence": max_conf,
        "image": {"width": W, "height": H},
        "model": {"task": task, "class_names": class_name_list},
        "detections": detections,
        "inference_ms": inference_ms,
    }

    if device_id:
        payload["device_id"] = device_id
    if capture_id:
        payload["capture_id"] = capture_id

    if want_annotated and len(detections) > 0:
        payload["annotated_image_base64"] = _encode_annotated_jpeg(
            bgr, xyxy, confs, clss, names
        )

    return payload
