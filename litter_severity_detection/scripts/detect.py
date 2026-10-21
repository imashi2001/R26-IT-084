"""
detect.py
=========
Run inference with a trained YOLO11s model, draw boxes, compute LSI, save images.

Usage:
  python scripts/detect.py --weights models/best.pt --source path/to/img_or_dir --save

Configuration:
  Defaults merge config/lsi_config.yaml (LSI weights, conf threshold, optional bin polygon).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import matplotlib.pyplot as plt
import numpy as np
import yaml
from ultralytics import YOLO

import calculate_lsi


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def draw_detections_bgr(
    image_bgr: np.ndarray,
    boxes_xyxy: np.ndarray,
    confidences: np.ndarray,
    class_ids: np.ndarray,
    names: Dict[int, str],
    color: Tuple[int, int, int] = (0, 165, 255),
) -> np.ndarray:
    """Draw axis-aligned boxes and confidence text (OpenCV BGR)."""
    out = image_bgr.copy()
    for i in range(boxes_xyxy.shape[0]):
        x1, y1, x2, y2 = map(int, boxes_xyxy[i].tolist())
        conf = float(confidences[i])
        cls_id = int(class_ids[i])
        label = names.get(cls_id, str(cls_id))
        # Rectangle for this detection.
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        caption = f"{label} {conf:.2f}"
        # Text background for readability.
        (tw, th), baseline = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(out, (x1, max(0, y1 - th - 6)), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            out,
            caption,
            (x1 + 2, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    return out


def draw_lsi_panel_bgr(
    image_bgr: np.ndarray,
    metrics: calculate_lsi.LSIMetrics,
    lsi_weights: Tuple[float, float, float],
) -> np.ndarray:
    """Overlay LSI summary (top-left) for thesis figures."""
    out = image_bgr.copy()
    h, w = out.shape[:2]
    overlay = out.copy()
    panel_h = 120
    cv2.rectangle(overlay, (0, 0), (min(w, 520), panel_h), (30, 30, 30), -1)
    cv2.addWeighted(overlay, 0.65, out, 0.35, 0, dst=out)

    wc, wa, ws = lsi_weights
    lines = [
        f"LSI: {metrics.lsi:.1f}  ({metrics.severity})",
        f"Count: {metrics.count}  |  Cov: {metrics.coverage_fraction*100:.1f}%",
        f"Scores  C:{metrics.count_score:.0f} A:{metrics.area_score:.0f} S:{metrics.spread_score:.0f}",
        f"Weights {wc:.1f}/{wa:.1f}/{ws:.1f}  |  MPD: {metrics.mean_pairwise_centroid_dist_px:.1f}px",
    ]
    y = 22
    for line in lines:
        cv2.putText(
            out,
            line,
            (12, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (240, 240, 240),
            1,
            cv2.LINE_AA,
        )
        y += 26
    return out


def gather_images(source: Path) -> List[Path]:
    if source.is_file():
        return [source]
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return sorted([p for p in source.rglob("*") if p.suffix.lower() in exts])


def parse_args() -> argparse.Namespace:
    root = project_root()
    p = argparse.ArgumentParser(description="Litter detection + LSI visualization.")
    p.add_argument("--weights", type=str, default=str(root / "models" / "best.pt"))
    p.add_argument("--source", type=str, required=True, help="Image file or folder.")
    p.add_argument(
        "--config",
        type=str,
        default=str(root / "config" / "lsi_config.yaml"),
        help="LSI + inference YAML.",
    )
    p.add_argument("--conf", type=float, default=None, help="Override confidence threshold.")
    p.add_argument("--iou", type=float, default=None, help="Override NMS IoU.")
    p.add_argument("--imgsz", type=int, default=None, help="Inference size (square).")
    p.add_argument(
        "--save",
        action="store_true",
        help="Write annotated images to results/ (always recommended).",
    )
    p.add_argument(
        "--show",
        action="store_true",
        help="Show matplotlib figure (turn off on headless servers).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    root = project_root()

    cfg = load_yaml(Path(args.config))
    inf = cfg.get("inference", {})
    conf = float(args.conf if args.conf is not None else inf.get("conf", 0.25))
    iou = float(args.iou if args.iou is not None else inf.get("iou", 0.45))
    imgsz = int(args.imgsz if args.imgsz is not None else inf.get("imgsz", 640))

    lsi_kw = calculate_lsi.load_lsi_config_dict(cfg)
    w_count, w_area, w_spread = lsi_kw["w_count"], lsi_kw["w_area"], lsi_kw["w_spread"]

    # Optional quadrilateral (or polygon) around the bin — drop in-bin centroids.
    bin_poly_cfg = cfg.get("bin_polygon")
    poly_np: Optional[np.ndarray] = None
    if isinstance(bin_poly_cfg, list) and len(bin_poly_cfg) >= 3:
        poly_np = np.asarray(bin_poly_cfg, dtype=np.float32)

    weights_path = Path(args.weights)
    if not weights_path.is_file():
        raise FileNotFoundError(f"Weights not found: {weights_path}")

    model = YOLO(str(weights_path))

    source = Path(args.source)
    images = gather_images(source)
    if not images:
        raise FileNotFoundError(f"No images under: {source}")

    results_dir = root / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    for img_path in images:
        # Read BGR for OpenCV pipeline.
        bgr = cv2.imread(str(img_path))
        if bgr is None:
            print(f"[skip] Cannot read: {img_path}")
            continue

        h, w = bgr.shape[:2]

        # Ultralytics predict returns Results list; stream=False for single images.
        res_list = model.predict(
            source=bgr,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            verbose=False,
        )
        res = res_list[0]
        boxes = res.boxes
        if boxes is None or len(boxes) == 0:
            xyxy = np.zeros((0, 4), dtype=np.float64)
            confs = np.zeros((0,), dtype=np.float64)
            clss = np.zeros((0,), dtype=np.int64)
        else:
            # xyxy: Tensor -> numpy (N, 4)
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            clss = boxes.cls.cpu().numpy().astype(np.int64)

        metrics = calculate_lsi.compute_lsi(
            xyxy,
            w,
            h,
            bin_polygon=poly_np,
            **lsi_kw,
        )

        names = res.names if isinstance(res.names, dict) else {i: str(v) for i, v in enumerate(res.names)}

        vis = draw_detections_bgr(bgr, xyxy, confs, clss, names)
        vis = draw_lsi_panel_bgr(vis, metrics, (w_count, w_area, w_spread))

        stem = img_path.stem
        out_path = results_dir / f"{stem}_lsi_{metrics.severity.lower()}_{metrics.lsi:.0f}.jpg"
        if args.save:
            cv2.imwrite(str(out_path), vis)
            print(f"Saved: {out_path}")
            payload = {
                "image": str(img_path),
                "weights": str(weights_path),
                "metrics": metrics.as_dict(),
                "signage_advisory": calculate_lsi.signage_advisory_for_severity(
                    metrics.severity
                ),
                "boxes_xyxy": xyxy.tolist(),
                "confidences": confs.tolist(),
            }
            log_path = out_path.with_suffix(".json")
            with log_path.open("w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)

        # Matplotlib view for Colab / local debugging.
        if args.show:
            rgb = cv2.cvtColor(vis, cv2.COLOR_BGR2RGB)
            plt.figure(figsize=(10, 6))
            plt.imshow(rgb)
            plt.title(f"Litter LSI = {metrics.lsi:.1f} ({metrics.severity})")
            plt.axis("off")
            plt.tight_layout()
            plt.show()


if __name__ == "__main__":
    main()
