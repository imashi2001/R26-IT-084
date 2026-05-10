"""Waste classification micro-service (Railway).

Single-purpose FastAPI app that loads a Keras MobileNetV2 model from
``model/waste_classification_model.h5`` and exposes ``POST /predict``.
Designed to be one of two services on Railway; the other is the YOLO
animal detector. The orchestrator backend calls both via HTTP.
"""

from __future__ import annotations

import io
import os
from functools import lru_cache
from typing import Any

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

import tensorflow as tf  # noqa: E402  (heavy import, kept after stdlib)

MODEL_PATH = os.environ.get("WASTE_MODEL_PATH", "model/waste_classification_model.h5")
CLASS_NAMES = ["non_organic", "organic"]
IMG_SIZE = (224, 224)
THRESHOLD = float(os.environ.get("WASTE_THRESHOLD", "0.5"))


@lru_cache(maxsize=1)
def _load_model() -> tf.keras.Model:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Waste model not found at '{MODEL_PATH}'. "
            "Set WASTE_MODEL_PATH or place the .h5 in services/waste-api/model/."
        )
    return tf.keras.models.load_model(MODEL_PATH)


def _preprocess(data: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")
    img = img.resize(IMG_SIZE)
    arr = np.asarray(img).astype(np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


app = FastAPI(title="Waste Classification API", version="1.0.0")

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
        # Don't crash the container if the file is missing; /health will report.
        pass


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "waste-classification",
        "model_path": MODEL_PATH,
        "endpoints": ["GET /health", "POST /predict"],
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
    x = _preprocess(data)
    model = _load_model()
    prob = float(model.predict(x, verbose=0).reshape(-1)[0])
    pred_idx = 1 if prob >= THRESHOLD else 0
    label = CLASS_NAMES[pred_idx]
    confidence = prob if label == "organic" else 1.0 - prob
    return {
        "model": "waste_classification",
        "label": label,
        "predicted_index": pred_idx,
        "organic_probability": prob,
        "confidence": confidence,
        "confidence_percent": round(confidence * 100, 2),
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
    }
