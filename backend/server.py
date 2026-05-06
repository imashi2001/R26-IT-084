import io
import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

MODEL_PATH = Path(__file__).parent / "model" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model weights not found at {MODEL_PATH}. "
        "Run train.py from the project root first, then copy best.pt here."
    )

model = YOLO(str(MODEL_PATH))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": str(MODEL_PATH)})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided. Send as multipart/form-data with key 'image'."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty filename received."}), 400

    try:
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Could not decode image: {str(e)}"}), 400

    conf_threshold = float(request.form.get("conf", 0.25))

    results = model(image, conf=conf_threshold)

    output = []
    for r in results:
        for box in r.boxes:
            coords = box.xyxy.tolist()[0]
            output.append(
                {
                    "label": model.names[int(box.cls)],
                    "confidence": round(float(box.conf), 4),
                    "box": [round(c, 2) for c in coords],
                }
            )

    return jsonify(output)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
