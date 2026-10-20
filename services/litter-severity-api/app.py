"""Litter Severity micro-service (Railway).

YOLO litter detections + Litter Severity Index (LSI). Same contract style as
animal-api: GET /health, POST /predict (multipart ``file``).

Optional multipart field ``bin_polygon``: JSON list of [x, y] points outlining
the bin in this camera view. Values in 0–1 are treated as fractions of the
image size, larger values as pixels. Litter whose box centre falls inside the
outline is ignored for the LSI. Falls back to ``bin_polygon`` in lsi_config.yaml.
"""

from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
import yaml
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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


# Only the Express backend calls this service (server-to-server, no CORS needed).
# Set CORS_ORIGINS="https://a.com,https://b.com" to allow browser access.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app = FastAPI(title="Litter Severity API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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


def parse_bin_polygon(raw: Any, width: int, height: int) -> Optional[np.ndarray]:
    """Return a (K, 2) pixel polygon or None when ``raw`` is missing/invalid."""
    if raw is None:
        return None
    pts = raw
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        try:
            pts = json.loads(text)
        except json.JSONDecodeError as e:
            raise HTTPException(400, f"bin_polygon is not valid JSON: {e}") from e
    if not isinstance(pts, list) or len(pts) < 3:
        return None
    try:
        arr = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    except (TypeError, ValueError) as e:
        raise HTTPException(400, "bin_polygon must be a list of [x, y] points.") from e
    if not np.all(np.isfinite(arr)):
        raise HTTPException(400, "bin_polygon contains non-numeric points.")
    if float(np.max(arr)) <= 1.0:
        arr = arr * np.array([float(width), float(height)])
    return arr.astype(np.float32)


def split_boxes_by_polygon(
    boxes_xyxy: np.ndarray, polygon: Optional[np.ndarray]
) -> Tuple[np.ndarray, np.ndarray]:
    """Boolean mask of boxes to keep (centre outside polygon) and to ignore."""
    n = boxes_xyxy.shape[0]
    keep = np.ones((n,), dtype=bool)
    if polygon is None or n == 0:
        return keep, ~keep
    contour = polygon.reshape(-1, 1, 2)
    centers = calculate_lsi.centroids_xyxy(boxes_xyxy)
    for i in range(n):
        inside = cv2.pointPolygonTest(
            contour, (float(centers[i, 0]), float(centers[i, 1])), measureDist=False
        )
        keep[i] = inside < 0
    return keep, ~keep


def draw_bin_polygon_bgr(image_bgr: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    out = image_bgr.copy()
    pts = polygon.astype(np.int32).reshape(-1, 1, 2)
    overlay = out.copy()
    cv2.fillPoly(overlay, [pts], (255, 200, 0))
    cv2.addWeighted(overlay, 0.18, out, 0.82, 0, dst=out)
    cv2.polylines(out, [pts], isClosed=True, color=(255, 200, 0), thickness=2)
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
async def predict(
    file: UploadFile = File(...),
    bin_polygon: Optional[str] = Form(None),
) -> dict[str, Any]:
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

    poly_np = parse_bin_polygon(bin_polygon, W, H)
    polygon_source = "request" if poly_np is not None else None
    if poly_np is None:
        poly_np = parse_bin_polygon(cfg.get("bin_polygon"), W, H)
        if poly_np is not None:
            polygon_source = "config"

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

    raw_count = int(xyxy.shape[0])
    keep, _ignored = split_boxes_by_polygon(xyxy, poly_np)
    xyxy, confs, clss = xyxy[keep], confs[keep], clss[keep]

    metrics = calculate_lsi.compute_lsi(xyxy, W, H, bin_polygon=None, **lsi_kw)
    names = res.names if isinstance(res.names, dict) else {i: str(v) for i, v in enumerate(res.names)}

    vis = bgr
    if poly_np is not None:
        vis = draw_bin_polygon_bgr(vis, poly_np)
    vis = draw_detections_bgr(vis, xyxy, confs, clss, names)
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
        "raw_detection_count": raw_count,
        "ignored_inside_bin": raw_count - len(detections),
        "bin_polygon_applied": poly_np is not None,
        "bin_polygon_source": polygon_source,
        "annotated_image_base64": img_b64,
        "image_size": {"width": W, "height": H},
        "inference_imgsz": imgsz,
        "conf_threshold": conf,
        "signage_advisory": calculate_lsi.signage_advisory_for_severity(metrics.severity),
    }
