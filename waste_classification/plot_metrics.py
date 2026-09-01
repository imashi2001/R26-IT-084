"""
Viva / presentation charts for the waste classification model.

Reads the held-out test metrics already written by evaluate_all.py and
saves PNG bar charts + a confusion-matrix heatmap.

Usage (from repo root R26-IT-084):
    python waste_classification/plot_metrics.py
"""

from __future__ import annotations

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = ROOT / "evaluation_results"
SUMMARY_CSV = EVAL_DIR / "summary.csv"
PER_CLASS_CSV = EVAL_DIR / "waste_per_class.csv"
CONFUSION_CSV = EVAL_DIR / "waste_confusion_matrix.csv"

# Slide-friendly colours (organic = green, non-organic = sky, overall = navy)
COLOR_ACCURACY = "#1d4ed8"
COLOR_PRECISION = "#0ea5e9"
COLOR_RECALL = "#22c55e"
COLOR_F1 = "#16a34a"
COLOR_NON_ORGANIC = "#0284c7"
COLOR_ORGANIC = "#16a34a"


def _to_percent(value: float) -> float:
    """sklearn scores are 0-1; accuracy in summary.csv is already 0-100."""
    return value * 100.0 if value <= 1.0 else value


def load_overall_metrics() -> dict[str, float]:
    """Accuracy + organic precision/recall/F1 from summary.csv."""
    metrics: dict[str, float] = {}
    with SUMMARY_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["model"] != "waste_mobilenetv2":
                continue
            if row["class_name"]:
                continue
            key = row["metric"]
            if key in {"accuracy", "precision_organic", "recall_organic", "f1_organic", "test_images"}:
                metrics[key] = float(row["value"])
    return metrics


def load_per_class_metrics() -> list[dict[str, float | str]]:
    """Precision, recall, F1, support for each waste class."""
    rows: list[dict[str, float | str]] = []
    with PER_CLASS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(
                {
                    "class": row["class"],
                    "precision": _to_percent(float(row["precision"])),
                    "recall": _to_percent(float(row["recall"])),
                    "f1": _to_percent(float(row["f1-score"])),
                    "support": float(row["support"]),
                }
            )
    return rows


def load_confusion_matrix() -> tuple[list[str], np.ndarray]:
    """2x2 counts: rows = true class, columns = predicted class."""
    with CONFUSION_CSV.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        labels = header[1:]
        matrix = np.array([[int(x) for x in row[1:]] for row in reader], dtype=int)
    return labels, matrix


def _annotate_bars(ax, bars, values: list[float], fmt: str = "{:.2f}%") -> None:
    for bar, value in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.8,
            fmt.format(value),
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
        )


def plot_overall(ax, overall: dict[str, float]) -> None:
    labels = ["Accuracy", "Precision\n(organic)", "Recall\n(organic)", "F1\n(organic)"]
    values = [
        overall["accuracy"],
        _to_percent(overall["precision_organic"]),
        _to_percent(overall["recall_organic"]),
        _to_percent(overall["f1_organic"]),
    ]
    colors = [COLOR_ACCURACY, COLOR_PRECISION, COLOR_RECALL, COLOR_F1]
    bars = ax.bar(labels, values, color=colors, width=0.62, zorder=3)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Score (%)")
    n = int(overall.get("test_images", 372))
    ax.set_title(f"Overall test metrics  (n = {n})")
    ax.yaxis.grid(True, linestyle="--", alpha=0.35, zorder=0)
    ax.set_axisbelow(True)
    _annotate_bars(ax, bars, values)


def plot_per_class(ax, per_class: list[dict[str, float | str]]) -> None:
    names = [str(r["class"]).replace("_", "\n") for r in per_class]
    precision = [float(r["precision"]) for r in per_class]
    recall = [float(r["recall"]) for r in per_class]
    f1 = [float(r["f1"]) for r in per_class]

    x = np.arange(len(names))
    width = 0.25
    b1 = ax.bar(x - width, precision, width, label="Precision", color=COLOR_PRECISION, zorder=3)
    b2 = ax.bar(x, recall, width, label="Recall", color=COLOR_RECALL, zorder=3)
    b3 = ax.bar(x + width, f1, width, label="F1-score", color=COLOR_F1, zorder=3)

    ax.set_xticks(x)
    ax.set_xticklabels(names)
    ax.set_ylim(0, 110)
    ax.set_ylabel("Score (%)")
    ax.set_title("Per-class precision, recall, F1")
    ax.legend(frameon=False, loc="lower right")
    ax.yaxis.grid(True, linestyle="--", alpha=0.35, zorder=0)
    ax.set_axisbelow(True)
    for bars, values in ((b1, precision), (b2, recall), (b3, f1)):
        _annotate_bars(ax, bars, values, "{:.1f}")


def plot_confusion(ax, labels: list[str], matrix: np.ndarray) -> None:
    im = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    pretty = [name.replace("_", " ") for name in labels]
    ax.set_xticklabels(pretty)
    ax.set_yticklabels(pretty)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Confusion matrix")
    vmax = int(matrix.max())
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            count = int(matrix[i, j])
            ax.text(
                j,
                i,
                str(count),
                ha="center",
                va="center",
                color="white" if count > vmax * 0.55 else "black",
                fontsize=14,
                fontweight="bold",
            )
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)


def save_figure(fig, name: str) -> Path:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    path = EVAL_DIR / name
    fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def main() -> None:
    overall = load_overall_metrics()
    per_class = load_per_class_metrics()
    labels, matrix = load_confusion_matrix()

    # --- Slide-ready combined figure ---
    fig, axes = plt.subplots(1, 3, figsize=(16.5, 5.2))
    plot_overall(axes[0], overall)
    plot_per_class(axes[1], per_class)
    plot_confusion(axes[2], labels, matrix)
    fig.suptitle(
        "Waste Classification (MobileNetV2) — held-out test set",
        fontsize=14,
        fontweight="bold",
        y=1.02,
    )
    fig.tight_layout()
    combined = save_figure(fig, "waste_viva_metrics.png")

    # --- Separate PNGs if you want one chart per slide ---
    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    plot_overall(ax, overall)
    fig.tight_layout()
    overall_path = save_figure(fig, "waste_overall_metrics.png")

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    plot_per_class(ax, per_class)
    fig.tight_layout()
    per_class_path = save_figure(fig, "waste_per_class_metrics.png")

    fig, ax = plt.subplots(figsize=(6.2, 5.2))
    plot_confusion(ax, labels, matrix)
    fig.tight_layout()
    confusion_path = save_figure(fig, "waste_confusion_matrix.png")

    print("Saved:")
    for path in (combined, overall_path, per_class_path, confusion_path):
        print(f"  {path}")


if __name__ == "__main__":
    main()
