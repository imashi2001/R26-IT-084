import os
from pathlib import Path
from ultralytics import YOLO

DATA_YAML = Path(__file__).parent / "dataset" / "data.yaml"
PROJECT_DIR = Path(__file__).parent / "runs"
EPOCHS = 50
IMG_SIZE = 640
BATCH = 16


def main():
    if not DATA_YAML.exists():
        raise FileNotFoundError(f"dataset/data.yaml not found at {DATA_YAML}")

    model = YOLO("yolov8n.pt")

    results = model.train(
        data=str(DATA_YAML),
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH,
        project=str(PROJECT_DIR),
        name="garbage_detect",
        exist_ok=True,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    dest = Path(__file__).parent / "backend" / "model" / "best.pt"
    dest.parent.mkdir(parents=True, exist_ok=True)

    import shutil
    shutil.copy2(best_weights, dest)
    print(f"\nTraining complete. Best weights saved to: {dest}")


if __name__ == "__main__":
    main()
