"""
Animal detection model training (YOLOv8) for R26-IT-084.

Run from the `animal_detection/` directory:
    cd animal_detection
    python train.py

Outputs are written to:
    animal_detection/runs/detect/train/weights/best.pt
    animal_detection/runs/detect/train/weights/last.pt
"""

from __future__ import annotations

import os
from pathlib import Path

from ultralytics import YOLO


HERE = Path(__file__).resolve().parent
DATA_YAML = HERE / "dataset" / "data.yaml"
PROJECT_DIR = HERE / "runs" / "detect"
RUN_NAME = "train"
MODELS_DIR = HERE / "models"
# yolov8n.pt is fast on CPU; for fewer dog/monkey confusions use e.g.
#   set YOLO_PRETRAINED=yolov8s.pt
# and train longer (YOLO_EPOCHS=50+).
PRETRAINED = os.environ.get("YOLO_PRETRAINED", "yolov8n.pt")

# Fast first-presentation config (CPU-friendly).
# Increase EPOCHS (e.g. 50) and IMG_SIZE (e.g. 640) once you have a GPU
# or want a stronger final run.
EPOCHS = int(os.environ.get("YOLO_EPOCHS", "10"))
IMG_SIZE = int(os.environ.get("YOLO_IMGSZ", "416"))
BATCH = int(os.environ.get("YOLO_BATCH", "8"))


def main() -> None:
    if not DATA_YAML.exists():
        raise FileNotFoundError(
            f"data.yaml not found at: {DATA_YAML}\n"
            "Make sure the Roboflow dataset is placed at "
            "animal_detection/dataset/."
        )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Using data.yaml: {DATA_YAML}")
    print(f"Pretrained weights: {PRETRAINED} (auto-downloaded if missing)")
    print(f"Config: epochs={EPOCHS}, imgsz={IMG_SIZE}, batch={BATCH}")

    model = YOLO(PRETRAINED)

    results = model.train(
        data=str(DATA_YAML),
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH,
        project=str(PROJECT_DIR),
        name=RUN_NAME,
        exist_ok=True,
        verbose=True,
    )

    weights_dir = PROJECT_DIR / RUN_NAME / "weights"
    best = weights_dir / "best.pt"
    if best.exists():
        target = MODELS_DIR / "best.pt"
        try:
            from shutil import copy2

            copy2(best, target)
            print(f"\nCopied best weights to: {target}")
        except Exception as e:
            print(f"\nFailed to copy best weights: {e}")

    print("\nTraining finished.")
    print(f"Best weights:   {weights_dir / 'best.pt'}")
    print(f"Last weights:   {weights_dir / 'last.pt'}")


if __name__ == "__main__":
    main()
