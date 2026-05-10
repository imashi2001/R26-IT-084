from __future__ import annotations

import base64
import csv
import io
import os
import time
from collections import deque
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from bins import get_bin, list_bins
from devices import resolve_device_id, server_device_id
from risk import compute_risk
from weather import get_current_weather

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

WASTE_MODEL_PATH = os.environ.get(
    "WASTE_MODEL_PATH",
    str(PROJECT_ROOT / "waste_classification" / "waste_classification_model.h5"),
)
ANIMAL_MODEL_PATH = os.environ.get(
    "ANIMAL_MODEL_PATH",
    str(PROJECT_ROOT / "animal_detection" / "models" / "best.pt"),
)
ANIMAL_RESULTS_CSV = PROJECT_ROOT / "animal_detection" / "runs" / "detect" / "train" / "results.csv"

CLASS_NAMES = ["non_organic", "organic"]
IMG_SIZE = (224, 224)
THRESHOLD = float(os.environ.get("WASTE_THRESHOLD", "0.5"))
ANIMAL_IMGSZ = int(os.environ.get("ANIMAL_IMGSZ", "416"))
ANIMAL_CONF = float(os.environ.get("ANIMAL_CONF", "0.25"))

# Default coordinates used when an /analyze call has no bin_id and no
# explicit lat/lon. Picked for the demo location (Colombo).
DEFAULT_WEATHER_LAT = float(os.environ.get("DEFAULT_WEATHER_LAT", "6.9271"))
DEFAULT_WEATHER_LON = float(os.environ.get("DEFAULT_WEATHER_LON", "79.8612"))

# Per-bin latest readings (legacy /predict, /predict/animal paths).
LATEST_WASTE: dict[str, dict[str, Any]] = {}
LATEST_ANIMALS: dict[str, dict[str, Any]] = {}

# In-memory history of recent /analyze calls so the dashboard can show a
# "Risk history" strip without a database. Capped to keep memory bounded.
HISTORY_MAX = int(os.environ.get("ANALYZE_HISTORY_MAX", "20"))
ANALYZE_HISTORY: deque[dict[str, Any]] = deque(maxlen=HISTORY_MAX)


@lru_cache(maxsize=1)
def _load_waste_model() -> tf.keras.Model:
    if not os.path.exists(WASTE_MODEL_PATH):
        raise FileNotFoundError(
            f"Waste model not found at '{WASTE_MODEL_PATH}'. Train or set WASTE_MODEL_PATH."
        )
    return tf.keras.models.load_model(WASTE_MODEL_PATH)


@lru_cache(maxsize=1)
def _load_animal_model():
    from ultralytics import YOLO

    if not os.path.exists(ANIMAL_MODEL_PATH):
        raise FileNotFoundError(
            f"Animal model not found at '{ANIMAL_MODEL_PATH}'. Train or set ANIMAL_MODEL_PATH."
        )
    return YOLO(ANIMAL_MODEL_PATH)


def _open_image(data: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")


def _preprocess_waste_image(pil: Image.Image) -> np.ndarray:
    img = pil.resize(IMG_SIZE)
    arr = np.asarray(img).astype(np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def _run_waste(pil: Image.Image) -> dict[str, Any]:
    x = _preprocess_waste_image(pil)
    model = _load_waste_model()
    prob = float(model.predict(x, verbose=0).reshape(-1)[0])
    pred_idx = 1 if prob >= THRESHOLD else 0
    label = CLASS_NAMES[pred_idx]
    confidence = prob if label == "organic" else 1.0 - prob
    return {
        "label": label,
        "predicted_index": pred_idx,
        "organic_probability": prob,
        "confidence": confidence,
        "confidence_percent": round(confidence * 100, 2),
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
    }


def _run_animal(pil: Image.Image) -> dict[str, Any]:
    model = _load_animal_model()
    # Ultralytics LoadPilAndNumpy converts PIL RGB to BGR internally.
    # A raw RGB ndarray would be passed through as if it were BGR and
    # silently swap R/B channels.
    results = model.predict(
        source=pil,
        imgsz=ANIMAL_IMGSZ,
        conf=ANIMAL_CONF,
        verbose=False,
    )
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
        "detections": detections,
        "detection_count": len(detections),
        "annotated_image_base64": img_b64,
        "inference_imgsz": ANIMAL_IMGSZ,
        "conf_threshold": ANIMAL_CONF,
    }


def _read_animal_metrics_from_csv() -> dict[str, Any] | None:
    if not ANIMAL_RESULTS_CSV.exists():
        return None
    try:
        with ANIMAL_RESULTS_CSV.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            return None
        last = rows[-1]
        return {
            "epoch": int(float(last["epoch"])),
            "precision": float(last["metrics/precision(B)"]),
            "recall": float(last["metrics/recall(B)"]),
            "map50": float(last["metrics/mAP50(B)"]),
            "map50_95": float(last["metrics/mAP50-95(B)"]),
            "source": str(ANIMAL_RESULTS_CSV.relative_to(PROJECT_ROOT)),
        }
    except Exception:
        return None


def _resolve_location(
    bin_id: str | None, lat: float | None, lon: float | None
) -> tuple[dict[str, Any] | None, float, float]:
    """Pick weather coordinates: bin > explicit lat/lon > defaults."""
    if bin_id:
        bin_doc = get_bin(bin_id)
        if not bin_doc:
            raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
        return bin_doc, float(bin_doc["lat"]), float(bin_doc["lng"])
    if lat is not None and lon is not None:
        return None, lat, lon
    return None, DEFAULT_WEATHER_LAT, DEFAULT_WEATHER_LON


def _build_risk_for_bin(bin_id: str) -> dict[str, Any] | None:
    bin_doc = get_bin(bin_id)
    if not bin_doc:
        return None

    weather = get_current_weather(float(bin_doc["lat"]), float(bin_doc["lng"]))

    waste_reading = LATEST_WASTE.get(bin_id)
    animal_reading = LATEST_ANIMALS.get(bin_id)
    animals = (animal_reading or {}).get("detections", []) if animal_reading else []

    risk = compute_risk(
        bin_doc=bin_doc,
        weather=weather,
        waste=waste_reading,
        animals=animals,
    )

    return {
        "bin": bin_doc,
        "weather": weather,
        "latest_waste": waste_reading,
        "latest_animals": animal_reading,
        "risk": risk,
    }


app = FastAPI(title="Smart Waste + Animal Detection API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    waste_ok = False
    waste_err = None
    try:
        _ = _load_waste_model()
        waste_ok = True
    except Exception as e:
        waste_err = f"{type(e).__name__}: {e}"

    animal_ok = False
    animal_err = None
    try:
        _ = _load_animal_model()
        animal_ok = True
    except Exception as e:
        animal_err = f"{type(e).__name__}: {e}"

    return {
        "waste_ok": waste_ok,
        "waste_model_path": WASTE_MODEL_PATH,
        "waste_error": waste_err,
        "animal_ok": animal_ok,
        "animal_model_path": ANIMAL_MODEL_PATH,
        "animal_error": animal_err,
        "server_device_id": server_device_id(),
    }


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    waste_acc = float(os.environ.get("WASTE_TEST_ACCURACY", "0.9758"))
    animal_block = _read_animal_metrics_from_csv()
    animal_names = ["cat", "crow", "dog", "monkey"]

    return {
        "waste": {
            "test_accuracy": waste_acc,
            "test_accuracy_percent": round(waste_acc * 100, 2),
            "class_names": CLASS_NAMES,
            "note": "Test-set accuracy from last train_model.py run (override with WASTE_TEST_ACCURACY).",
        },
        "animal": (
            {**animal_block, "class_names": animal_names}
            if animal_block
            else None
        ),
        "animal_metrics_missing": animal_block is None,
    }


@app.get("/bins")
def bins_index() -> dict[str, Any]:
    return {"bins": list_bins()}


@app.get("/bins/{bin_id}")
def bin_detail(bin_id: str) -> dict[str, Any]:
    bin_doc = get_bin(bin_id)
    if not bin_doc:
        raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
    return bin_doc


@app.get("/weather/{bin_id}")
def weather_for_bin(bin_id: str) -> dict[str, Any]:
    bin_doc = get_bin(bin_id)
    if not bin_doc:
        raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
    return {
        "bin_id": bin_id,
        "weather": get_current_weather(float(bin_doc["lat"]), float(bin_doc["lng"])),
    }


@app.get("/risk/{bin_id}")
def risk_for_bin(bin_id: str) -> dict[str, Any]:
    snapshot = _build_risk_for_bin(bin_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
    return snapshot


@app.get("/analyze/history")
def analyze_history() -> dict[str, Any]:
    return {"history": list(ANALYZE_HISTORY)}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    bin_id: str | None = Form(default=None),
    lat: float | None = Form(default=None),
    lon: float | None = Form(default=None),
    device_id: str | None = Form(default=None),
    bridge_instance_id: str | None = Form(default=None),
    esp32_id: str | None = Form(default=None),
) -> dict[str, Any]:
    """Single ESP32-CAM image -> waste + animal + weather + rule risk.

    Form fields (multipart):
      - file (required) : JPEG bytes from the ESP32 camera
      - bin_id          : optional registered bin id (drives weather coords + name)
      - lat, lon        : optional override for weather coords
      - device_id       : laptop bridge id ("PC ID"); falls back to bridge_instance_id
      - bridge_instance_id : same idea as the bridge on the test branch
      - esp32_id        : optional ESP32 hardware id for traceability
    """
    data = await file.read()
    pil = _open_image(data)

    bin_doc, weather_lat, weather_lon = _resolve_location(bin_id, lat, lon)
    weather = get_current_weather(weather_lat, weather_lon)

    waste_result = _run_waste(pil)
    animal_result = _run_animal(pil)

    if bin_id:
        LATEST_WASTE[bin_id] = {
            "label": waste_result["label"],
            "organic_probability": waste_result["organic_probability"],
            "ts": time.time(),
        }
        LATEST_ANIMALS[bin_id] = {
            "detections": animal_result["detections"],
            "detection_count": animal_result["detection_count"],
            "ts": time.time(),
        }

    risk = compute_risk(
        waste={
            "label": waste_result["label"],
            "organic_probability": waste_result["organic_probability"],
        },
        animals=animal_result["detections"],
        weather=weather,
        bin_doc=bin_doc,
    )

    resolved_device_id = resolve_device_id(device_id, bridge_instance_id)

    now_utc = datetime.now(timezone.utc)
    response = {
        "model": "smart_waste_v1",
        "server_time": now_utc.isoformat(),
        "device_id": resolved_device_id,
        "esp32_id": esp32_id,
        "bin": bin_doc,
        "location": {"lat": weather_lat, "lon": weather_lon},
        "weather": weather,
        "waste": waste_result,
        "animals": {
            "detections": animal_result["detections"],
            "detection_count": animal_result["detection_count"],
            "no_animal_attacks": animal_result["detection_count"] == 0,
            "annotated_image_base64": animal_result["annotated_image_base64"],
            "inference_imgsz": animal_result["inference_imgsz"],
            "conf_threshold": animal_result["conf_threshold"],
        },
        "risk": risk,
        "image_size": {"width": pil.width, "height": pil.height},
    }

    ANALYZE_HISTORY.appendleft(
        {
            "ts": now_utc.isoformat(),
            "device_id": resolved_device_id,
            "esp32_id": esp32_id,
            "bin_id": bin_id,
            "level": risk["level"],
            "case": risk["case"],
            "waste_label": waste_result["label"],
            "animal_count": animal_result["detection_count"],
            "temp_c": weather.get("temp_c"),
            "humidity_pct": weather.get("humidity_pct"),
            "rotting_hours": risk["rotting_hours"],
        }
    )

    return response


@app.post("/predict")
async def predict_waste(
    file: UploadFile = File(...),
    bin_id: str | None = Form(default=None),
) -> dict[str, Any]:
    """Legacy waste-only endpoint, kept for backwards compatibility."""
    data = await file.read()
    pil = _open_image(data)
    waste_result = _run_waste(pil)

    response: dict[str, Any] = {
        "model": "waste_classification",
        "organic_probability": waste_result["organic_probability"],
        "predicted_label": waste_result["label"],
        "predicted_index": waste_result["predicted_index"],
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
        "bin_id": bin_id,
    }

    if bin_id:
        bin_doc = get_bin(bin_id)
        if not bin_doc:
            raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
        LATEST_WASTE[bin_id] = {
            "label": waste_result["label"],
            "organic_probability": waste_result["organic_probability"],
            "ts": time.time(),
        }
        snapshot = _build_risk_for_bin(bin_id)
        if snapshot:
            response["risk"] = snapshot["risk"]
            response["weather"] = snapshot["weather"]
            response["bin"] = snapshot["bin"]

    return response


@app.post("/predict/animal")
async def predict_animal(
    file: UploadFile = File(...),
    bin_id: str | None = Form(default=None),
) -> dict[str, Any]:
    """Legacy animal-only endpoint, kept for backwards compatibility."""
    data = await file.read()
    pil = _open_image(data)
    animal_result = _run_animal(pil)

    response: dict[str, Any] = {
        "model": "animal_detection",
        "detections": animal_result["detections"],
        "detection_count": animal_result["detection_count"],
        "annotated_image_base64": animal_result["annotated_image_base64"],
        "image_size": {"width": pil.width, "height": pil.height},
        "inference_imgsz": animal_result["inference_imgsz"],
        "conf_threshold": animal_result["conf_threshold"],
        "bin_id": bin_id,
    }

    if bin_id:
        bin_doc = get_bin(bin_id)
        if not bin_doc:
            raise HTTPException(status_code=404, detail=f"Unknown bin: {bin_id}")
        LATEST_ANIMALS[bin_id] = {
            "detections": animal_result["detections"],
            "detection_count": animal_result["detection_count"],
            "ts": time.time(),
        }
        snapshot = _build_risk_for_bin(bin_id)
        if snapshot:
            response["risk"] = snapshot["risk"]
            response["weather"] = snapshot["weather"]
            response["bin"] = snapshot["bin"]

    return response
