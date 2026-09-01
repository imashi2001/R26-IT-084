"""
Viva / presentation charts for the animal detection model (YOLOv8n).

Reads held-out test metrics from evaluate_all.py and saves PNG bar charts.

Usage (from repo root R26-IT-084):
    python animal_detection/plot_metrics.py
"""

from __future__ import annotations

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = ROOT / "evaluation_results"
SUMMARY_CSV = EVAL_DIR / "summary.csv"
PER_CLASS_CSV = EVAL_DIR / "animal_yolov8_per_class.csv"
DATASET_CSV = EVAL_DIR / "dataset_summary.csv"

COLOR_MAP50 = "#1d4ed8"
COLOR_MAP5095 = "#7c3aed"
COLOR_PRECISION = "#0ea5e9"
COLOR_RECALL = "#22c55e"
CLASS_COLORS = {
    "cat": "#f59e0b",
    "crow": "#334155",
    "dog": "#0284c7",
    "monkey": "#16a34a",
}


def _to_percent(value: float) -> float:
    return value * 100.0 if value <= 1.0 else value


def load_overall() -> dict[str, float]:
    metrics: dict[str, float] = {}
    with SUMMARY_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["model"] != "animal_yolov8":
                continue
            if row["class_name"]:
                continue
            key = row["metric"]
            if key in {"mAP50", "mAP50-95", "precision", "recall"}:
                metrics[key] = _to_percent(float(row["value"]))
    return metrics


def load_per_class() -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    with PER_CLASS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append((row["class"], _to_percent(float(row["mAP50-95"]))))
    return rows


def load_test_image_count() -> int:
    if not DATASET_CSV.is_file():
        return 130
    with DATASET_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["model"] == "animal_yolov8" and row["split"] == "test":
                return int(float(row["images"]))
    return 130


def _annotate_bars(ax, bars, values: list[float], fmt: str = "{:.1f}%") -> None:
    for bar, value in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 1.2,
            fmt.format(value),
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
        )


def plot_overall(ax, overall: dict[str, float], n_test: int) -> None:
    labels = ["mAP@0.5", "mAP@0.5:0.95", "Precision", "Recall"]
    keys = ["mAP50", "mAP50-95", "precision", "recall"]
    values = [overall[k] for k in keys]
    colors = [COLOR_MAP50, COLOR_MAP5095, COLOR_PRECISION, COLOR_RECALL]
    bars = ax.bar(labels, values, color=colors, width=0.62, zorder=3)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Score (%)")
    ax.set_title(f"Overall test metrics  (n = {n_test} images)")
    ax.yaxis.grid(True, linestyle="--", alpha=0.35, zorder=0)
    ax.set_axisbelow(True)
    _annotate_bars(ax, bars, values)


def plot_per_class(ax, per_class: list[tuple[str, float]]) -> None:
    names = [name for name, _ in per_class]
    values = [val for _, val in per_class]
    colors = [CLASS_COLORS.get(name, "#64748b") for name in names]
    bars = ax.bar(names, values, color=colors, width=0.62, zorder=3)
    ax.set_ylim(0, 100)
    ax.set_ylabel("mAP@0.5:0.95 (%)")
    ax.set_title("Per-class mAP@0.5:0.95")
    ax.yaxis.grid(True, linestyle="--", alpha=0.35, zorder=0)
    ax.set_axisbelow(True)
    _annotate_bars(ax, bars, values)


def plot_class_ranking(ax, per_class: list[tuple[str, float]]) -> None:
    """Horizontal bars so monkey (weakest) is easy to point at in viva."""
    ordered = sorted(per_class, key=lambda item: item[1])
    names = [name for name, _ in ordered]
    values = [val for _, val in ordered]
    colors = [CLASS_COLORS.get(name, "#64748b") for name in names]
    y = np.arange(len(names))
    bars = ax.barh(y, values, color=colors, height=0.55, zorder=3)
    ax.set_yticks(y)
    ax.set_yticklabels(names)
    ax.set_xlim(0, 100)
    ax.set_xlabel("mAP@0.5:0.95 (%)")
    ax.set_title("Class ranking (weakest → strongest)")
    ax.xaxis.grid(True, linestyle="--", alpha=0.35, zorder=0)
    ax.set_axisbelow(True)
    for bar, value in zip(bars, values):
        ax.text(
            value + 1.5,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.1f}%",
            va="center",
            fontsize=9,
            fontweight="bold",
        )


def save_figure(fig, name: str) -> Path:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    path = EVAL_DIR / name
    fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def main() -> None:
    overall = load_overall()
    per_class = load_per_class()
    n_test = load_test_image_count()

    fig, axes = plt.subplots(1, 3, figsize=(16.5, 5.2))
    plot_overall(axes[0], overall, n_test)
    plot_per_class(axes[1], per_class)
    plot_class_ranking(axes[2], per_class)
    fig.suptitle(
        "Animal Detection (YOLOv8n) — held-out test set  |  cat · crow · dog · monkey",
        fontsize=14,
        fontweight="bold",
        y=1.02,
    )
    fig.tight_layout()
    combined = save_figure(fig, "animal_viva_metrics.png")

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    plot_overall(ax, overall, n_test)
    fig.tight_layout()
    overall_path = save_figure(fig, "animal_overall_metrics.png")

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    plot_per_class(ax, per_class)
    fig.tight_layout()
    per_class_path = save_figure(fig, "animal_per_class_metrics.png")

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    plot_class_ranking(ax, per_class)
    fig.tight_layout()
    ranking_path = save_figure(fig, "animal_class_ranking.png")

    print("Saved:")
    for path in (combined, overall_path, per_class_path, ranking_path):
        print(f"  {path}")


if __name__ == "__main__":
    main()
