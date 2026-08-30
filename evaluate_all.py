#!/usr/bin/env python3
"""
Unified offline evaluation for R26-IT-084 / VisionWaste models.

Runs held-out test metrics for each model and writes paper-ready CSV/JSON/Markdown
reports under evaluation_results/ (override with --output-dir).

Usage:
    python evaluate_all.py                  # evaluate everything available
    python evaluate_all.py --model waste    # one model only
    python evaluate_all.py --split val      # YOLO val split instead of test

Models:
    waste   - MobileNetV2 binary classifier (organic vs non_organic)
    animal  - YOLOv8 animal detector (cat, crow, dog, monkey)
    bin     - YOLOv8 bin-fill detector (needs dataset/data.yaml)
    litter  - YOLO litter detector (optional weights + data yaml)
    risk    - Rule-based risk engine scenario tests (not ML accuracy)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Default paths (override with CLI flags or env vars)
# ---------------------------------------------------------------------------

DEFAULT_PATHS = {
    "waste_model": ROOT / "services/waste-api/model/waste_classification_model.h5",
    "waste_test_dir": ROOT / "waste_classification/data_set/test",
    "waste_data_root": ROOT / "waste_classification/data_set",
    "animal_model": ROOT / "services/animal-api/model/best.pt",
    "animal_data_yaml": ROOT / "animal_detection/dataset/data.yaml",
    "bin_model": ROOT / "model-yolo/model/best.pt",
    "bin_data_yaml": ROOT / "dataset/data.yaml",
    "litter_model": ROOT / "services/litter-severity-api/model/best.pt",
    "litter_data_yaml": ROOT / "services/litter-severity-api/dataset/data.yaml",
}

WASTE_CLASS_NAMES = ["non_organic", "organic"]
WASTE_THRESHOLD = float(os.environ.get("WASTE_THRESHOLD", "0.5"))
WASTE_IMG_SIZE = (224, 224)
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

HIGH_TEMP_C = float(os.environ.get("HIGH_TEMP_C", "30"))
HIGH_HUMIDITY_PCT = float(os.environ.get("HIGH_HUMIDITY_PCT", "70"))


@dataclass
class MetricRow:
    model: str
    metric: str
    value: float | str
    split: str = "test"
    class_name: str = ""
    notes: str = ""


@dataclass
class EvalReport:
    generated_at: str
    rows: List[MetricRow] = field(default_factory=list)
    dataset_rows: List[Dict[str, Any]] = field(default_factory=list)
    skipped: List[Dict[str, str]] = field(default_factory=list)
    artifacts: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fmt(value: float | int | None, digits: int = 4) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, np.integer)):
        return str(int(value))
    if isinstance(value, (float, np.floating)):
        if np.isnan(value):
            return ""
        return f"{float(value):.{digits}f}"
    return str(value)


def _append_metric(
    report: EvalReport,
    model: str,
    metric: str,
    value: float | str,
    *,
    split: str = "test",
    class_name: str = "",
    notes: str = "",
) -> None:
    report.rows.append(
        MetricRow(
            model=model,
            metric=metric,
            value=value,
            split=split,
            class_name=class_name,
            notes=notes,
        )
    )


def _count_images(root: Path) -> int:
    if not root.is_dir():
        return 0
    count = 0
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if Path(fn).suffix.lower() in ALLOWED_IMAGE_EXTS:
                count += 1
    return count


def _count_yolo_split_images(data_yaml: Path, split: str) -> int:
    cfg = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
    base = _resolve_dataset_root(data_yaml, cfg)
    key = "val" if split == "valid" else split
    rel = str(cfg.get(key, f"{split}/images"))
    return _count_images(base / rel)


def _collect_waste_samples(test_dir: Path) -> Tuple[List[Tuple[str, int]], List[str]]:
    if not test_dir.is_dir():
        return [], [f"Missing test directory: {test_dir}"]

    class_dirs = sorted(
        d.name for d in test_dir.iterdir() if d.is_dir()
    )
    if class_dirs != WASTE_CLASS_NAMES:
        return [], [
            f"Expected class folders {WASTE_CLASS_NAMES}, found {class_dirs}"
        ]

    samples: List[Tuple[str, int]] = []
    skipped: List[str] = []
    for label, cls in enumerate(WASTE_CLASS_NAMES):
        cls_dir = test_dir / cls
        for dirpath, _, filenames in os.walk(cls_dir):
            for fn in filenames:
                if Path(fn).suffix.lower() not in ALLOWED_IMAGE_EXTS:
                    continue
                path = str(Path(dirpath) / fn)
                try:
                    with open(path, "rb") as f:
                        f.read(16)
                    samples.append((path, label))
                except OSError as exc:
                    skipped.append(f"{path} ({exc})")
    return samples, skipped


def _resolve_dataset_root(data_yaml: Path, cfg: Dict[str, Any]) -> Path:
    raw = cfg.get("path")
    if raw:
        p = Path(str(raw))
        if not p.is_absolute():
            p = (data_yaml.parent / p).resolve()
        else:
            p = p.resolve()
        return p
    return data_yaml.parent.resolve()


def _write_normalized_yolo_yaml(source_yaml: Path, output_yaml: Path) -> Path:
    cfg = yaml.safe_load(source_yaml.read_text(encoding="utf-8")) or {}
    dataset_root = _resolve_dataset_root(source_yaml, cfg)
    normalized = dict(cfg)
    normalized["path"] = str(dataset_root).replace("\\", "/")
    output_yaml.parent.mkdir(parents=True, exist_ok=True)
    output_yaml.write_text(yaml.safe_dump(normalized, sort_keys=False), encoding="utf-8")
    return output_yaml


def _save_confusion_matrix_png(matrix: np.ndarray, labels: Sequence[str], out_path: Path) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return

    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Confusion matrix")

    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(j, i, int(matrix[i, j]), ha="center", va="center", color="black")

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Waste classifier
# ---------------------------------------------------------------------------


def evaluate_waste(report: EvalReport, output_dir: Path, model_path: Path, test_dir: Path) -> None:
    model_name = "waste_mobilenetv2"

    if not model_path.is_file():
        report.skipped.append(
            {"model": model_name, "reason": f"Model not found: {model_path}"}
        )
        return

    samples, issues = _collect_waste_samples(test_dir)
    if issues:
        report.skipped.append({"model": model_name, "reason": "; ".join(issues)})
        return
    if not samples:
        report.skipped.append(
            {"model": model_name, "reason": f"No test images under {test_dir}"}
        )
        return

    _append_metric(report, model_name, "test_images", len(samples))

    import tensorflow as tf
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )

    model = tf.keras.models.load_model(str(model_path))

    y_true: List[int] = []
    y_pred: List[int] = []
    for path, label in samples:
        img = tf.keras.utils.load_img(path, target_size=WASTE_IMG_SIZE)
        arr = tf.keras.utils.img_to_array(img) / 255.0
        batch = np.expand_dims(arr, axis=0)
        prob = float(model.predict(batch, verbose=0)[0][0])
        pred = 1 if prob >= WASTE_THRESHOLD else 0
        y_true.append(label)
        y_pred.append(pred)

    y_true_arr = np.array(y_true)
    y_pred_arr = np.array(y_pred)

    acc = accuracy_score(y_true_arr, y_pred_arr)
    prec = precision_score(y_true_arr, y_pred_arr, average="binary", pos_label=1)
    rec = recall_score(y_true_arr, y_pred_arr, average="binary", pos_label=1)
    f1 = f1_score(y_true_arr, y_pred_arr, average="binary", pos_label=1)

    _append_metric(report, model_name, "accuracy", _fmt(acc * 100, 2), notes="percent")
    _append_metric(report, model_name, "precision_organic", _fmt(prec, 4))
    _append_metric(report, model_name, "recall_organic", _fmt(rec, 4))
    _append_metric(report, model_name, "f1_organic", _fmt(f1, 4))

    cm = confusion_matrix(y_true_arr, y_pred_arr, labels=[0, 1])
    cm_path = output_dir / "waste_confusion_matrix.csv"
    with cm_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["true\\pred"] + WASTE_CLASS_NAMES)
        for i, row_name in enumerate(WASTE_CLASS_NAMES):
            writer.writerow([row_name] + [int(x) for x in cm[i]])
    report.artifacts.append(str(cm_path))

    png_path = output_dir / "waste_confusion_matrix.png"
    _save_confusion_matrix_png(cm, WASTE_CLASS_NAMES, png_path)
    if png_path.exists():
        report.artifacts.append(str(png_path))

    cls_report = classification_report(
        y_true_arr,
        y_pred_arr,
        target_names=WASTE_CLASS_NAMES,
        output_dict=True,
        zero_division=0,
    )
    per_class_path = output_dir / "waste_per_class.csv"
    with per_class_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["class", "precision", "recall", "f1-score", "support"]
        )
        writer.writeheader()
        for cls in WASTE_CLASS_NAMES:
            stats = cls_report.get(cls, {})
            writer.writerow(
                {
                    "class": cls,
                    "precision": _fmt(stats.get("precision"), 4),
                    "recall": _fmt(stats.get("recall"), 4),
                    "f1-score": _fmt(stats.get("f1-score"), 4),
                    "support": int(stats.get("support", 0)),
                }
            )
    report.artifacts.append(str(per_class_path))

    for cls in WASTE_CLASS_NAMES:
        stats = cls_report.get(cls, {})
        _append_metric(
            report,
            model_name,
            "precision",
            _fmt(stats.get("precision"), 4),
            class_name=cls,
        )
        _append_metric(
            report,
            model_name,
            "recall",
            _fmt(stats.get("recall"), 4),
            class_name=cls,
        )
        _append_metric(
            report,
            model_name,
            "f1",
            _fmt(stats.get("f1-score"), 4),
            class_name=cls,
        )


# ---------------------------------------------------------------------------
# YOLO detectors (animal, bin fill, litter)
# ---------------------------------------------------------------------------


def evaluate_yolo(
    report: EvalReport,
    output_dir: Path,
    *,
    model_name: str,
    model_path: Path,
    data_yaml: Path,
    split: str,
) -> bool:
    if not model_path.is_file():
        report.skipped.append(
            {"model": model_name, "reason": f"Model not found: {model_path}"}
        )
        return False
    if not data_yaml.is_file():
        report.skipped.append(
            {"model": model_name, "reason": f"data.yaml not found: {data_yaml}"}
        )
        return False

    split_images = _count_yolo_split_images(data_yaml, split)
    if split_images == 0:
        report.skipped.append(
            {
                "model": model_name,
                "reason": f"No images in {split} split defined by {data_yaml}",
            }
        )
        return False

    from ultralytics import YOLO

    normalized_yaml = _write_normalized_yolo_yaml(
        data_yaml, output_dir / f"{model_name}_data.yaml"
    )
    model = YOLO(str(model_path))
    results = model.val(
        data=str(normalized_yaml),
        split=split,
        verbose=False,
        plots=True,
        project=str(output_dir / "yolo_runs"),
        name=model_name,
        exist_ok=True,
    )

    box = results.box
    _append_metric(report, model_name, "mAP50", _fmt(box.map50, 4), split=split)
    _append_metric(report, model_name, "mAP50-95", _fmt(box.map, 4), split=split)
    _append_metric(report, model_name, "precision", _fmt(box.mp, 4), split=split)
    _append_metric(report, model_name, "recall", _fmt(box.mr, 4), split=split)

    class_names = list(results.names.values()) if hasattr(results, "names") else []
    maps = getattr(box, "maps", None)
    if maps is not None and class_names:
        per_class_path = output_dir / f"{model_name}_per_class.csv"
        with per_class_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["class", "mAP50-95", "split"]
            )
            writer.writeheader()
            for idx, cls in enumerate(class_names):
                map_val = float(maps[idx]) if idx < len(maps) else float("nan")
                writer.writerow(
                    {
                        "class": cls,
                        "mAP50-95": _fmt(map_val, 4),
                        "split": split,
                    }
                )
                _append_metric(
                    report,
                    model_name,
                    "mAP50-95",
                    _fmt(map_val, 4),
                    split=split,
                    class_name=cls,
                )
        report.artifacts.append(str(per_class_path))

    run_dir = Path(results.save_dir) if getattr(results, "save_dir", None) else None
    if run_dir:
        for name in ("confusion_matrix.png", "confusion_matrix_normalized.png", "results.csv"):
            candidate = run_dir / name
            if candidate.exists():
                report.artifacts.append(str(candidate))

    return True


def _extract_yolo_checkpoint_metrics(model_path: Path) -> Optional[Dict[str, Any]]:
    """Read best-epoch validation metrics stored inside a YOLO .pt checkpoint."""
    try:
        from ultralytics import YOLO
    except ImportError:
        return None

    model = YOLO(str(model_path))
    ckpt = getattr(model, "ckpt", None) or {}
    train_metrics = ckpt.get("train_metrics") or {}
    train_results = ckpt.get("train_results") or {}

    def _last(seq: Any) -> Optional[float]:
        if isinstance(seq, (list, tuple)) and seq:
            return float(seq[-1])
        if isinstance(seq, (int, float)):
            return float(seq)
        return None

    metrics = {
        "precision": train_metrics.get("metrics/precision(B)") or _last(
            train_results.get("metrics/precision(B)")
        ),
        "recall": train_metrics.get("metrics/recall(B)") or _last(
            train_results.get("metrics/recall(B)")
        ),
        "map50": train_metrics.get("metrics/mAP50(B)") or _last(
            train_results.get("metrics/mAP50(B)")
        ),
        "map50_95": train_metrics.get("metrics/mAP50-95(B)") or _last(
            train_results.get("metrics/mAP50-95(B)")
        ),
        "epoch": ckpt.get("epoch"),
        "best_fitness": ckpt.get("best_fitness") or train_metrics.get("fitness"),
        "class_names": list(getattr(model, "names", {}).values()),
        "train_data": (ckpt.get("train_args") or {}).get("data"),
        "train_project": (ckpt.get("train_args") or {}).get("project"),
        "train_name": (ckpt.get("train_args") or {}).get("name"),
    }
    if metrics["map50_95"] is None and metrics["best_fitness"] is not None:
        metrics["map50_95"] = float(metrics["best_fitness"])
    if metrics["map50_95"] is None:
        return None
    return metrics


def evaluate_yolo_checkpoint_fallback(
    report: EvalReport,
    output_dir: Path,
    *,
    model_name: str,
    model_path: Path,
    split_label: str = "val",
) -> None:
    """Use metrics baked into best.pt when the labeled dataset is not available locally."""
    metrics = _extract_yolo_checkpoint_metrics(model_path)
    if not metrics:
        report.skipped.append(
            {
                "model": model_name,
                "reason": f"No checkpoint metrics found in {model_path}",
            }
        )
        return

    note = (
        "From best.pt checkpoint (training-time validation, not a fresh test run). "
        f"Original train data: {metrics.get('train_data') or 'unknown'}"
    )

    _append_metric(
        report,
        model_name,
        "mAP50",
        _fmt(metrics.get("map50"), 4),
        split=split_label,
        notes=note,
    )
    _append_metric(
        report,
        model_name,
        "mAP50-95",
        _fmt(metrics.get("map50_95"), 4),
        split=split_label,
        notes=note,
    )
    _append_metric(
        report,
        model_name,
        "precision",
        _fmt(metrics.get("precision"), 4),
        split=split_label,
        notes=note,
    )
    _append_metric(
        report,
        model_name,
        "recall",
        _fmt(metrics.get("recall"), 4),
        split=split_label,
        notes=note,
    )
    if metrics.get("epoch") is not None:
        _append_metric(
            report,
            model_name,
            "best_epoch",
            int(metrics["epoch"]),
            split=split_label,
            notes=note,
        )

    ckpt_path = output_dir / f"{model_name}_checkpoint_metrics.csv"
    with ckpt_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "model",
                "metric",
                "value",
                "split",
                "classes",
                "train_data",
                "notes",
            ],
        )
        writer.writeheader()
        class_str = ", ".join(metrics.get("class_names") or [])
        for metric_key, src_key in (
            ("mAP50", "map50"),
            ("mAP50-95", "map50_95"),
            ("precision", "precision"),
            ("recall", "recall"),
        ):
            writer.writerow(
                {
                    "model": model_name,
                    "metric": metric_key,
                    "value": _fmt(metrics.get(src_key), 4),
                    "split": split_label,
                    "classes": class_str,
                    "train_data": metrics.get("train_data") or "",
                    "notes": note,
                }
            )
    report.artifacts.append(str(ckpt_path))

    for cls in metrics.get("class_names") or []:
        _append_metric(
            report,
            model_name,
            "class",
            cls,
            split=split_label,
            notes="class list from checkpoint (per-class mAP needs dataset re-val)",
        )


def maybe_download_bin_dataset(data_yaml: Path) -> bool:
    """Download Charuka's Roboflow bin-fill dataset when ROBOFLOW_API_KEY is set."""
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        return False

    cfg = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
    roboflow_meta = cfg.get("roboflow") or {}
    workspace = roboflow_meta.get("workspace")
    project = roboflow_meta.get("project")
    version = roboflow_meta.get("version")
    if not (workspace and project and version):
        return False

    try:
        from roboflow import Roboflow
    except ImportError:
        print("[bin] roboflow package not installed; skip auto-download.")
        return False

    print(
        f"[bin] Downloading {workspace}/{project} v{version} from Roboflow..."
    )
    rf = Roboflow(api_key=api_key)
    rf.workspace(workspace).project(project).version(int(version)).download(
        "yolov8",
        location=str(data_yaml.parent),
    )
    return _count_yolo_split_images(data_yaml, "test") > 0 or _count_yolo_split_images(
        data_yaml, "val"
    ) > 0


def evaluate_bin_fill(
    report: EvalReport,
    output_dir: Path,
    *,
    model_path: Path,
    data_yaml: Path,
    split: str,
    allow_checkpoint_fallback: bool = True,
    download_dataset: bool = False,
) -> None:
    model_name = "bin_fill_yolov8"

    if download_dataset and data_yaml.is_file():
        maybe_download_bin_dataset(data_yaml)

    ran = False
    if data_yaml.is_file():
        split_images = _count_yolo_split_images(data_yaml, split)
        val_images = _count_yolo_split_images(data_yaml, "val")
        if split_images == 0 and val_images > 0 and split == "test":
            print("[bin] test split empty; falling back to val split...")
            split = "val"
            split_images = val_images

        if split_images > 0:
            print(f"[bin] Running YOLO val split={split}...")
            ran = bool(
                evaluate_yolo(
                    report,
                    output_dir,
                    model_name=model_name,
                    model_path=model_path,
                    data_yaml=data_yaml,
                    split=split,
                )
            )

    if ran:
        return

    if allow_checkpoint_fallback and model_path.is_file():
        print(
            "[bin] Dataset images not found locally — using metrics embedded in best.pt "
            "(training validation). For a fresh test-set report, download the Roboflow dataset "
            "into dataset/ (see dataset/README.roboflow.txt)."
        )
        evaluate_yolo_checkpoint_fallback(
            report,
            output_dir,
            model_name=model_name,
            model_path=model_path,
            split_label="val",
        )
        return

    if not data_yaml.is_file():
        report.skipped.append(
            {"model": model_name, "reason": f"data.yaml not found: {data_yaml}"}
        )
    elif not model_path.is_file():
        report.skipped.append(
            {"model": model_name, "reason": f"Model not found: {model_path}"}
        )
    else:
        report.skipped.append(
            {
                "model": model_name,
                "reason": (
                    f"No images for split '{split}' under {data_yaml}. "
                    "Download dataset from Roboflow (dataset/README.roboflow.txt)."
                ),
            }
        )


# ---------------------------------------------------------------------------
# Rule-based risk engine (scenario correctness)
# ---------------------------------------------------------------------------


def _compute_risk(
    *,
    waste_label: Optional[str],
    animals: Sequence[Dict[str, Any]],
    temp_c: float = 25.0,
    humidity_pct: float = 50.0,
) -> Dict[str, str]:
    waste = (waste_label or "").lower()
    is_organic = waste == "organic"
    has_animal = len(animals) > 0
    high_temp = temp_c >= HIGH_TEMP_C
    high_hum = humidity_pct >= HIGH_HUMIDITY_PCT

    if is_organic and has_animal:
        return {"case": "CASE_3", "level": "HIGH"}
    if not is_organic and has_animal:
        return {"case": "EXTRA_NONORGANIC_WITH_ANIMAL", "level": "HIGH"}
    if is_organic and high_temp and high_hum:
        return {"case": "CASE_2", "level": "MEDIUM"}
    if is_organic:
        return {"case": "CASE_1", "level": "LOW"}
    return {"case": "EXTRA_NONORGANIC_CLEAR", "level": "LOW"}


def evaluate_risk_engine(report: EvalReport, output_dir: Path) -> None:
    model_name = "risk_engine_rules"

    scenarios: List[Dict[str, Any]] = [
        {
            "name": "CASE_3 organic + dog",
            "waste_label": "organic",
            "animals": [{"class_name": "dog"}],
            "temp_c": 25,
            "humidity_pct": 50,
            "expected_case": "CASE_3",
            "expected_level": "HIGH",
        },
        {
            "name": "CASE_2 organic + hot humid, no animals",
            "waste_label": "organic",
            "animals": [],
            "temp_c": 35,
            "humidity_pct": 80,
            "expected_case": "CASE_2",
            "expected_level": "MEDIUM",
        },
        {
            "name": "CASE_1 organic + normal weather",
            "waste_label": "organic",
            "animals": [],
            "temp_c": 25,
            "humidity_pct": 50,
            "expected_case": "CASE_1",
            "expected_level": "LOW",
        },
        {
            "name": "EXTRA non-organic + crow",
            "waste_label": "non_organic",
            "animals": [{"class_name": "crow"}],
            "temp_c": 25,
            "humidity_pct": 50,
            "expected_case": "EXTRA_NONORGANIC_WITH_ANIMAL",
            "expected_level": "HIGH",
        },
        {
            "name": "EXTRA non-organic + clear",
            "waste_label": "non_organic",
            "animals": [],
            "temp_c": 25,
            "humidity_pct": 50,
            "expected_case": "EXTRA_NONORGANIC_CLEAR",
            "expected_level": "LOW",
        },
        {
            "name": "Organic + high temp only (not CASE_2)",
            "waste_label": "organic",
            "animals": [],
            "temp_c": 35,
            "humidity_pct": 50,
            "expected_case": "CASE_1",
            "expected_level": "LOW",
        },
    ]

    rows: List[Dict[str, str]] = []
    passed = 0
    for sc in scenarios:
        out = _compute_risk(
            waste_label=sc["waste_label"],
            animals=sc["animals"],
            temp_c=sc["temp_c"],
            humidity_pct=sc["humidity_pct"],
        )
        ok = (
            out["case"] == sc["expected_case"]
            and out["level"] == sc["expected_level"]
        )
        passed += int(ok)
        rows.append(
            {
                "scenario": sc["name"],
                "expected_case": sc["expected_case"],
                "expected_level": sc["expected_level"],
                "actual_case": out["case"],
                "actual_level": out["level"],
                "pass": "yes" if ok else "no",
            }
        )

    scenario_path = output_dir / "risk_engine_scenarios.csv"
    with scenario_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    report.artifacts.append(str(scenario_path))

    accuracy = passed / len(scenarios) if scenarios else 0.0
    _append_metric(
        report,
        model_name,
        "scenario_accuracy",
        _fmt(accuracy * 100, 2),
        notes=f"{passed}/{len(scenarios)} scenarios; percent",
    )
    _append_metric(report, model_name, "scenarios_total", len(scenarios))
    _append_metric(report, model_name, "scenarios_passed", passed)


# ---------------------------------------------------------------------------
# Dataset summary (train/val/test counts when folders exist)
# ---------------------------------------------------------------------------


def collect_dataset_summary(report: EvalReport) -> None:
    waste_root = DEFAULT_PATHS["waste_data_root"]
    for split in ("train", "val", "test"):
        split_dir = waste_root / split
        if not split_dir.is_dir():
            continue
        for cls in WASTE_CLASS_NAMES:
            count = _count_images(split_dir / cls)
            if count:
                report.dataset_rows.append(
                    {
                        "model": "waste_mobilenetv2",
                        "split": split,
                        "class": cls,
                        "images": count,
                    }
                )

    animal_yaml = DEFAULT_PATHS["animal_data_yaml"]
    if animal_yaml.is_file():
        for split in ("train", "valid", "test"):
            count = _count_yolo_split_images(animal_yaml, split)
            if count:
                report.dataset_rows.append(
                    {
                        "model": "animal_yolov8",
                        "split": split,
                        "class": "(all)",
                        "images": count,
                    }
                )

    bin_yaml = DEFAULT_PATHS["bin_data_yaml"]
    if bin_yaml.is_file():
        for split in ("train", "valid", "test"):
            count = _count_yolo_split_images(bin_yaml, split)
            if count:
                report.dataset_rows.append(
                    {
                        "model": "bin_fill_yolov8",
                        "split": split,
                        "class": "(all)",
                        "images": count,
                    }
                )


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------


def write_summary_csv(report: EvalReport, path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["model", "metric", "value", "split", "class_name", "notes"],
        )
        writer.writeheader()
        for row in report.rows:
            writer.writerow(asdict(row))


def write_dataset_csv(report: EvalReport, path: Path) -> None:
    if not report.dataset_rows:
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["model", "split", "class", "images"]
        )
        writer.writeheader()
        writer.writerows(report.dataset_rows)


def write_report_md(report: EvalReport, path: Path) -> None:
    lines = [
        "# VisionWaste model evaluation report",
        "",
        f"Generated: {report.generated_at}",
        "",
        "## Summary metrics (for conference paper)",
        "",
        "| Model | Metric | Value | Split | Class | Notes |",
        "|---|---|---:|---|---|---|",
    ]

    for row in report.rows:
        if row.class_name:
            continue
        lines.append(
            f"| {row.model} | {row.metric} | {row.value} | {row.split} | | {row.notes} |"
        )

    lines.extend(["", "## Per-class metrics", ""])
    for row in report.rows:
        if not row.class_name:
            continue
        lines.append(
            f"- **{row.model}** / {row.class_name}: {row.metric} = {row.value} ({row.split})"
        )

    if report.dataset_rows:
        lines.extend(["", "## Dataset sizes", ""])
        lines.append("| Model | Split | Class | Images |")
        lines.append("|---|---|---|---:|")
        for ds in report.dataset_rows:
            lines.append(
                f"| {ds['model']} | {ds['split']} | {ds['class']} | {ds['images']} |"
            )

    if report.skipped:
        lines.extend(["", "## Skipped", ""])
        for item in report.skipped:
            lines.append(f"- **{item['model']}**: {item['reason']}")

    if report.artifacts:
        lines.extend(["", "## Artifacts", ""])
        for art in report.artifacts:
            lines.append(f"- `{art}`")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_json(report: EvalReport, path: Path) -> None:
    payload = {
        "generated_at": report.generated_at,
        "metrics": [asdict(r) for r in report.rows],
        "dataset": report.dataset_rows,
        "skipped": report.skipped,
        "artifacts": report.artifacts,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate all VisionWaste models and export paper-ready metrics."
    )
    parser.add_argument(
        "--model",
        choices=["all", "waste", "animal", "bin", "litter", "risk"],
        default="all",
        help="Which model(s) to evaluate (default: all)",
    )
    parser.add_argument(
        "--split",
        choices=["test", "val", "valid"],
        default="test",
        help="YOLO evaluation split (default: test)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "evaluation_results",
        help="Directory for CSV/JSON/Markdown outputs",
    )
    parser.add_argument(
        "--waste-model",
        type=Path,
        default=DEFAULT_PATHS["waste_model"],
    )
    parser.add_argument(
        "--waste-test-dir",
        type=Path,
        default=DEFAULT_PATHS["waste_test_dir"],
    )
    parser.add_argument(
        "--animal-model",
        type=Path,
        default=DEFAULT_PATHS["animal_model"],
    )
    parser.add_argument(
        "--animal-data-yaml",
        type=Path,
        default=DEFAULT_PATHS["animal_data_yaml"],
    )
    parser.add_argument(
        "--bin-model",
        type=Path,
        default=DEFAULT_PATHS["bin_model"],
    )
    parser.add_argument(
        "--bin-data-yaml",
        type=Path,
        default=DEFAULT_PATHS["bin_data_yaml"],
    )
    parser.add_argument(
        "--litter-model",
        type=Path,
        default=DEFAULT_PATHS["litter_model"],
    )
    parser.add_argument(
        "--litter-data-yaml",
        type=Path,
        default=DEFAULT_PATHS["litter_data_yaml"],
    )
    parser.add_argument(
        "--download-bin-dataset",
        action="store_true",
        help="Download bin-fill dataset from Roboflow (needs ROBOFLOW_API_KEY)",
    )
    parser.add_argument(
        "--no-bin-checkpoint-fallback",
        action="store_true",
        help="Do not use embedded best.pt metrics when bin dataset is missing",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    yolo_split = "val" if args.split == "valid" else args.split

    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    report = EvalReport(
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    )

    collect_dataset_summary(report)

    selected = {
        "waste",
        "animal",
        "bin",
        "litter",
        "risk",
    } if args.model == "all" else {args.model}

    if "waste" in selected:
        print("[waste] Evaluating MobileNetV2 on test set...")
        evaluate_waste(report, output_dir, args.waste_model, args.waste_test_dir)

    if "animal" in selected:
        print(f"[animal] Running YOLO val split={yolo_split}...")
        evaluate_yolo(
            report,
            output_dir,
            model_name="animal_yolov8",
            model_path=args.animal_model,
            data_yaml=args.animal_data_yaml,
            split=yolo_split,
        )

    if "bin" in selected:
        evaluate_bin_fill(
            report,
            output_dir,
            model_path=args.bin_model,
            data_yaml=args.bin_data_yaml,
            split=yolo_split,
            allow_checkpoint_fallback=not args.no_bin_checkpoint_fallback,
            download_dataset=args.download_bin_dataset,
        )

    if "litter" in selected:
        print(f"[litter] Running YOLO val split={yolo_split}...")
        evaluate_yolo(
            report,
            output_dir,
            model_name="litter_yolov8",
            model_path=args.litter_model,
            data_yaml=args.litter_data_yaml,
            split=yolo_split,
        )

    if "risk" in selected:
        print("[risk] Running rule-engine scenario tests...")
        evaluate_risk_engine(report, output_dir)

    summary_csv = output_dir / "summary.csv"
    dataset_csv = output_dir / "dataset_summary.csv"
    report_md = output_dir / "report.md"
    report_json = output_dir / "summary.json"

    write_summary_csv(report, summary_csv)
    write_dataset_csv(report, dataset_csv)
    write_report_md(report, report_md)
    write_json(report, report_json)

    print("\nDone. Outputs:")
    print(f"  {summary_csv}")
    print(f"  {dataset_csv}")
    print(f"  {report_md}")
    print(f"  {report_json}")

    if report.skipped:
        print("\nSkipped:")
        for item in report.skipped:
            print(f"  - {item['model']}: {item['reason']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
