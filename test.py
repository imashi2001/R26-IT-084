import sys
from pathlib import Path
from ultralytics import YOLO

MODEL_PATH = Path(__file__).parent / "backend" / "model" / "best.pt"
CONF_THRESHOLD = 0.25


def run_inference(image_path: str) -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train.py first."
        )

    model = YOLO(str(MODEL_PATH))
    results = model(image_path, conf=CONF_THRESHOLD)

    print(f"\nResults for: {image_path}")
    print("-" * 50)
    for r in results:
        if len(r.boxes) == 0:
            print("No detections above confidence threshold.")
            continue
        for box in r.boxes:
            label = model.names[int(box.cls)]
            confidence = float(box.conf)
            coords = box.xyxy.tolist()[0]
            print(
                f"  Label: {label:<10}  Confidence: {confidence:.2f}  "
                f"Box: [{coords[0]:.0f}, {coords[1]:.0f}, {coords[2]:.0f}, {coords[3]:.0f}]"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test.py <image_path>")
        sys.exit(1)
    run_inference(sys.argv[1])
