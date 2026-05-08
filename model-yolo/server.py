"""YOLO inference microservice.

Standalone Flask service that exposes a single inference endpoint.
It does NOT know about users, DB, auth, or other models - it just runs YOLO
on an uploaded image and returns predictions in a common JSON shape.

The main backend (gateway) is the only component that calls this service.
"""

import io
import os
from pathlib import Path

from flask import Flask, jsonify, request
from PIL import Image
from ultralytics import YOLO

app = Flask(__name__)

MODEL_NAME = os.environ.get("MODEL_NAME", "yolo")
MODEL_PATH = Path(__file__).parent / "model" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model weights not found at {MODEL_PATH}. "
        "Place best.pt at model-yolo/model/best.pt before starting."
    )

model = YOLO(str(MODEL_PATH))


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "service": "model-yolo",
            "model": MODEL_NAME,
            "weights": str(MODEL_PATH),
        }
    )


@app.route("/infer", methods=["POST"])
def infer():
    if "image" not in request.files:
        return (
            jsonify(
                {
                    "error": "No image file provided. "
                    "Send as multipart/form-data with key 'image'."
                }
            ),
            400,
        )

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename received."}), 400

    try:
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Could not decode image: {str(e)}"}), 400

    try:
        conf_threshold = float(request.form.get("conf", 0.25))
    except ValueError:
        conf_threshold = 0.25

    results = model(image, conf=conf_threshold)

    predictions = []
    for r in results:
        for box in r.boxes:
            coords = box.xyxy.tolist()[0]
            predictions.append(
                {
                    "label": model.names[int(box.cls)],
                    "confidence": round(float(box.conf), 4),
                    "box": [round(c, 2) for c in coords],
                }
            )

    return jsonify(
        {
            "model": MODEL_NAME,
            "predictions": predictions,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 6000))
    app.run(host="0.0.0.0", port=port, debug=True)
