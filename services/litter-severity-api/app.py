"""Litter Severity micro-service (Railway).

YOLO litter detections + Litter Severity Index (LSI). Same contract style as
animal-api: GET /health, POST /predict (multipart ``file``).
"""

from __future__ import annotations

import base64
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
import yaml
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

import calculate_lsi

ROOT = Path(__file__).resolve().parent
MODEL_PATH = Path(os.environ.get("LITTER_MODEL_PATH", str(ROOT / "model" / "best.pt")))
CONFIG_PATH = Path(os.environ.get("LITTER_CONFIG_PATH", str(ROOT / "lsi_config.yaml")))


def load_yaml_cfg() -> Dict[str, Any]:
    if not CONFIG_PATH.is_file():
        return {}
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def _load_model() -> YOLO:
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Litter model not found at '{MODEL_PATH}'. "
            "Place best.pt in model/ or set LITTER_MODEL_PATH."
        )
    return YOLO(str(MODEL_PATH))


app = FastAPI(title="Litter Severity API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def draw_detections_bgr(
    image_bgr: np.ndarray,
    boxes_xyxy: np.ndarray,
    confidences: np.ndarray,
    class_ids: np.ndarray,
    names: Dict[int, str],
) -> np.ndarray:
    out = image_bgr.copy()
    color = (0, 165, 255)
    for i in range(boxes_xyxy.shape[0]):
        x1, y1, x2, y2 = map(int, boxes_xyxy[i].tolist())
        conf = float(confidences[i])
        cls_id = int(class_ids[i])
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
    return out


def draw_lsi_panel_bgr(
    image_bgr: np.ndarray,
    metrics: calculate_lsi.LSIMetrics,
    lsi_weights: tuple[float, float, float],
) -> np.ndarray:
    out = image_bgr.copy()
    h, w = out.shape[:2]
    overlay = out.copy()
    panel_h = 120
    cv2.rectangle(overlay, (0, 0), (min(w, 520), panel_h), (30, 30, 30), -1)
    cv2.addWeighted(overlay, 0.65, out, 0.35, 0, dst=out)
    wc, wa, ws = lsi_weights
    lines = [
        f"LSI: {metrics.lsi:.1f}  ({metrics.severity})",
        f"Count: {metrics.count}  |  Cov: {metrics.coverage_fraction*100:.1f}%",
        f"Scores C:{metrics.count_score:.0f} A:{metrics.area_score:.0f} S:{metrics.spread_score:.0f}",
        f"Weights {wc:.1f}/{wa:.1f}/{ws:.1f}",
    ]
    y = 22
    for line in lines:
        cv2.putText(
            out,
            line,
            (12, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (240, 240, 240),
            1,
            cv2.LINE_AA,
        )
        y += 26
    return out


@app.on_event("startup")
def _warmup() -> None:
    try:
        _load_model()
    except Exception:
        pass


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "litter-severity",
        "model_path": str(MODEL_PATH),
        "endpoints": ["GET /health", "POST /predict"],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    ok = False
    err: Optional[str] = None
    try:
        _ = _load_model()
        ok = True
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
    return {"ok": ok, "model_path": str(MODEL_PATH), "error": err}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload an image (JPEG/PNG/WebP).")

    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 25 MB).")

    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(400, "Could not decode image.")

    H, W = bgr.shape[:2]
    cfg = load_yaml_cfg()
    inf = cfg.get("inference", {})
    conf = float(inf.get("conf", 0.25))
    iou = float(inf.get("iou", 0.45))
    imgsz = int(inf.get("imgsz", 640))
    lsi_kw = calculate_lsi.load_lsi_config_dict(cfg)
    w_count, w_area, w_spread = lsi_kw["w_count"], lsi_kw["w_area"], lsi_kw["w_spread"]

    bin_poly = cfg.get("bin_polygon")
    poly_np = None
    if isinstance(bin_poly, list) and len(bin_poly) >= 3:
        poly_np = np.asarray(bin_poly, dtype=np.float32)

    try:
        model = _load_model()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e

    res_list = model.predict(
        source=bgr,
        conf=conf,
        iou=iou,
        imgsz=imgsz,
        verbose=False,
    )
    res = res_list[0]
    boxes = res.boxes
    if boxes is None or len(boxes) == 0:
        xyxy = np.zeros((0, 4), dtype=np.float64)
        confs = np.zeros((0,), dtype=np.float64)
        clss = np.zeros((0,), dtype=np.int64)
    else:
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(np.int64)

    metrics = calculate_lsi.compute_lsi(
        xyxy, W, H, bin_polygon=poly_np, **lsi_kw
    )
    names = res.names if isinstance(res.names, dict) else {i: str(v) for i, v in enumerate(res.names)}

    vis = draw_detections_bgr(bgr, xyxy, confs, clss, names)
    vis = draw_lsi_panel_bgr(vis, metrics, (w_count, w_area, w_spread))
    ok, buf = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(500, "Failed to encode preview.")
    img_b64 = base64.standard_b64encode(buf.tobytes()).decode("ascii")

    detections: list[dict[str, Any]] = []
    for i in range(xyxy.shape[0]):
        detections.append(
            {
                "label": names.get(int(clss[i]), str(int(clss[i]))),
                "confidence": float(confs[i]),
                "box": [float(x) for x in xyxy[i].tolist()],
            }
        )

    return {
        "model": "litter_severity",
        "lsi": metrics.lsi,
        "severity": metrics.severity,
        "metrics": metrics.as_dict(),
        "detections": detections,
        "detection_count": len(detections),
        "annotated_image_base64": img_b64,
        "image_size": {"width": W, "height": H},
        "inference_imgsz": imgsz,
        "conf_threshold": conf,
        "signage_advisory": calculate_lsi.signage_advisory_for_severity(metrics.severity),
    }
