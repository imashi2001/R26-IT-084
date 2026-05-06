from __future__ import annotations

import io
import os
from functools import lru_cache
from typing import Any

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image


MODEL_PATH = os.environ.get("WASTE_MODEL_PATH", "waste_classification_model.h5")
# Folder-name alphabetical mapping used by training:
# ['non_organic', 'organic'] => non_organic=0, organic=1
CLASS_NAMES = ["non_organic", "organic"]
IMG_SIZE = (224, 224)
THRESHOLD = float(os.environ.get("WASTE_THRESHOLD", "0.5"))


@lru_cache(maxsize=1)
def _load_model() -> tf.keras.Model:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at '{MODEL_PATH}'. Train first or set WASTE_MODEL_PATH."
        )
    return tf.keras.models.load_model(MODEL_PATH)


def _preprocess_image_bytes(data: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {type(e).__name__}")

    img = img.resize(IMG_SIZE)
    arr = np.asarray(img).astype(np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)  # (1, 224, 224, 3)
    return arr


app = FastAPI(title="Waste Classification API", version="0.1.0")

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
    try:
        _ = _load_model()
        ok = True
        err = None
    except Exception as e:
        ok = False
        err = f"{type(e).__name__}: {e}"

    return {
        "ok": ok,
        "model_path": MODEL_PATH,
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
        "error": err,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    x = _preprocess_image_bytes(data)

    model = _load_model()
    prob = float(model.predict(x, verbose=0).reshape(-1)[0])
    pred_idx = 1 if prob >= THRESHOLD else 0

    return {
        "organic_probability": prob,
        "predicted_label": CLASS_NAMES[pred_idx],
        "predicted_index": pred_idx,
        "class_names": CLASS_NAMES,
        "threshold": THRESHOLD,
    }

