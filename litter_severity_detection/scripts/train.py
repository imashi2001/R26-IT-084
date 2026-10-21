"""
train.py
========
Fine-tune Ultralytics YOLO11s on your single-class litter dataset.

Usage (from litter_severity_detection/):
  python scripts/train.py --data dataset/data.yaml --epochs 100 --batch 16

After training, best weights are copied to models/best.pt for detect.py.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train YOLO11s for litter detection.")
    p.add_argument(
        "--data",
        type=str,
        default="dataset/data.yaml",
        help="Path to data.yaml (Ultralytics format).",
    )
    p.add_argument(
        "--model",
        type=str,
        default="yolo11s.pt",
        help="Pretrained checkpoint (YOLO11 Small). Downloads automatically.",
    )
    p.add_argument("--epochs", type=int, default=100, help="Training epochs.")
    p.add_argument("--imgsz", type=int, default=640, help="Train/val image size.")
    p.add_argument("--batch", type=int, default=16, help="Batch size (-1 for auto).")
    p.add_argument(
        "--device",
        type=str,
        default="",
        help="CUDA device, e.g. '0' or '0,1'. Empty = Ultralytics default (GPU if available).",
    )
    p.add_argument(
        "--project",
        type=str,
        default="runs",
        help="Ultralytics project directory (under litter_severity_detection/).",
    )
    p.add_argument(
        "--name",
        type=str,
        default="litter_yolo11s",
        help="Run name (creates runs/<name>).",
    )
    p.add_argument(
        "--patience",
        type=int,
        default=50,
        help="Early stopping patience (epochs without improvement).",
    )
    p.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Dataloader workers (use 2–4 on Windows if you see spawn errors).",
    )
    p.add_argument(
        "--exist-ok",
        action="store_true",
        help="Allow overwriting an existing run folder.",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # Resolve paths relative to package root (parent of scripts/).
    root = Path(__file__).resolve().parents[1]
    data_path = (root / args.data).resolve()
    if not data_path.is_file():
        raise FileNotFoundError(f"Missing data yaml: {data_path}")

    # Load pretrained small model (Ultralytics downloads yolo11s.pt on first use).
    model = YOLO(args.model)

    # Train: Ultralytics writes to project/name and saves weights/best.pt inside.
    train_kw = dict(
        data=str(data_path),
        epochs=int(args.epochs),
        imgsz=int(args.imgsz),
        batch=int(args.batch),
        project=str(root / args.project),
        name=args.name,
        patience=int(args.patience),
        exist_ok=bool(args.exist_ok),
        pretrained=True,
        verbose=True,
    )
    if args.workers is not None:
        train_kw["workers"] = int(args.workers)
    if args.device:
        train_kw["device"] = args.device

    model.train(**train_kw)

    # Best weights path after training.
    run_dir = root / args.project / args.name
    best = run_dir / "weights" / "best.pt"
    if not best.is_file():
        raise FileNotFoundError(f"Expected best weights at {best}")

    out_dir = root / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "best.pt"
    shutil.copy2(best, dest)
    print(f"Copied best weights to: {dest}")


if __name__ == "__main__":
    main()
