#!/usr/bin/env python3
"""Held-out test evaluation + confusion matrix for bin-fill YOLOv8n.

Usage (from repo root):
  1) Download Roboflow YOLOv8 export into dataset/ (train/valid/test)
     OR: set ROBOFLOW_API_KEY and pass --download
  2) python scripts/eval_bin_fill_test.py
  3) Optional: python scripts/eval_bin_fill_test.py --split val

Outputs under evaluation_results/bin_fill_test_run/
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = ROOT / "services" / "fill-api" / "model" / "best.pt"
DEFAULT_DATA = ROOT / "dataset" / "data.yaml"
OUT_DIR = ROOT / "evaluation_results" / "bin_fill_test_run"


def _count_images(data_yaml: Path, split: str) -> int:
    import yaml

    cfg = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
    base = data_yaml.parent
    path_cfg = cfg.get("path")
    if path_cfg:
        p = Path(path_cfg)
        base = p if p.is_absolute() else (data_yaml.parent / p).resolve()
    key = "val" if split in ("val", "valid") else split
    rel = str(cfg.get(key, f"{'valid' if key == 'val' else key}/images"))
    folder = base / rel
    if not folder.is_dir():
        return 0
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    return sum(1 for f in folder.rglob("*") if f.suffix.lower() in exts)


def maybe_download(data_yaml: Path) -> None:
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        print("ROBOFLOW_API_KEY not set — skipping download.")
        return
    import yaml
    from roboflow import Roboflow

    cfg = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
    meta = cfg.get("roboflow") or {}
    print(f"Downloading {meta.get('workspace')}/{meta.get('project')} v{meta.get('version')}...")
    rf = Roboflow(api_key=api_key)
    rf.workspace(meta["workspace"]).project(meta["project"]).version(int(meta["version"])).download(
        "yolov8", location=str(data_yaml.parent)
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--split", choices=("test", "val"), default="test")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--output", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    if not args.model.is_file():
        print(f"ERROR: model not found: {args.model}", file=sys.stderr)
        return 1
    if not args.data.is_file():
        print(f"ERROR: data.yaml not found: {args.data}", file=sys.stderr)
        return 1

    if args.download:
        maybe_download(args.data)

    n = _count_images(args.data, args.split)
    if n == 0 and args.split == "test":
        print("test split empty; trying val...")
        args.split = "val"
        n = _count_images(args.data, args.split)
    if n == 0:
        print(
            "ERROR: No images found. Download Roboflow YOLOv8 export into dataset/\n"
            "  https://universe.roboflow.com/charuka-edirisinghe/garbage_fill_level/dataset/2\n"
            "Or: set ROBOFLOW_API_KEY and re-run with --download",
            file=sys.stderr,
        )
        return 2

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: pip install ultralytics pyyaml roboflow", file=sys.stderr)
        return 3

    args.output.mkdir(parents=True, exist_ok=True)
    print(f"Evaluating {args.model} on split={args.split} ({n} images)...")

    model = YOLO(str(args.model))
    results = model.val(
        data=str(args.data),
        split=args.split,
        imgsz=args.imgsz,
        conf=args.conf,
        plots=True,
        project=str(args.output),
        name=f"bin_fill_{args.split}",
        exist_ok=True,
    )

    box = results.box
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": str(args.model),
        "data": str(args.data),
        "split": args.split,
        "images": n,
        "precision": float(box.mp),
        "recall": float(box.mr),
        "mAP50": float(box.map50),
        "mAP50-95": float(box.map),
        "conf": args.conf,
        "imgsz": args.imgsz,
        "class_names": list(results.names.values()) if hasattr(results, "names") else [],
    }

    run_dir = Path(results.save_dir)
    for name in (
        "confusion_matrix.png",
        "confusion_matrix_normalized.png",
        "BoxPR_curve.png",
        "BoxF1_curve.png",
        "results.csv",
    ):
        src = run_dir / name
        if src.exists():
            dst = args.output / f"{args.split}_{name}"
            shutil.copy2(src, dst)
            summary.setdefault("artifacts", []).append(str(dst))

    metrics_csv = args.output / f"{args.split}_metrics.csv"
    with metrics_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["metric", "value", "split"])
        w.writeheader()
        for k in ("precision", "recall", "mAP50", "mAP50-95", "images"):
            w.writerow({"metric": k, "value": summary[k], "split": args.split})

    (args.output / f"{args.split}_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    md = args.output / f"{args.split}_report.md"
    md.write_text(
        "\n".join(
            [
                f"# Bin-fill held-out evaluation ({args.split})",
                "",
                f"- Model: `{args.model}`",
                f"- Images: **{n}**",
                f"- Precision: **{summary['precision']:.4f}**",
                f"- Recall: **{summary['recall']:.4f}**",
                f"- mAP@0.5: **{summary['mAP50']:.4f}**",
                f"- mAP@0.5:0.95: **{summary['mAP50-95']:.4f}**",
                "",
                "Confusion matrices:",
                f"- `{args.split}_confusion_matrix.png`",
                f"- `{args.split}_confusion_matrix_normalized.png`",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2))
    print(f"Wrote {md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
