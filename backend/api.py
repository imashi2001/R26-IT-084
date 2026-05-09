from __future__ import annotations

import base64
import csv
import io
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

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


def _preprocess_waste_bytes(data: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")

    img = img.resize(IMG_SIZE)
    arr = np.asarray(img).astype(np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)
    return arr


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


app = FastAPI(title="Smart Waste + Animal Detection API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
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


@app.post("/predict")
async def predict_waste(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    x = _preprocess_waste_bytes(data)

    model = _load_waste_model()
    prob = float(model.predict(x, verbose=0).reshape(-1)[0])
    pred_idx = 1 if prob >= THRESHOLD else 0

    return {
        "model": "waste_classification",
        "organic_probability": prob,
        "predicted_label": CLASS_NAMES[pred_idx],
        "predicted_index": pred_idx,
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
    }


@app.post("/predict/animal")
async def predict_animal(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")

    model = _load_animal_model()
    results = model.predict(
        source=np.asarray(pil),
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
        "model": "animal_detection",
        "detections": detections,
        "detection_count": len(detections),
        "annotated_image_base64": img_b64,
        "image_size": {"width": pil.width, "height": pil.height},
        "inference_imgsz": ANIMAL_IMGSZ,
        "conf_threshold": ANIMAL_CONF,
    }
