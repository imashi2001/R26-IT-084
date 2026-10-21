"""
calculate_lsi.py
================
Research-grade, reusable Litter Severity Index (LSI) utilities.

LSI (0–100) combines:
  - Count score:   how many litter instances are visible (capped).
  - Area score:    how much of the image they cover (sum of bbox areas).
  - Spread score:  how dispersed litter is (centroid pairwise distance).

Formula (configurable weights, default):
  LSI = 0.5 * CountScore + 0.3 * AreaScore + 0.2 * SpreadScore

Severity bands:
  LOW    : 0–30
  MEDIUM : 31–60
  HIGH   : 61–100

This module has **no** Ultralytics dependency so you can unit-test scores quickly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

import numpy as np

# OpenCV is optional for polygon filtering; detect.py always has it.
try:
    import cv2
except ImportError:  # pragma: no cover - Colab/local always installs opencv-python
    cv2 = None


SeverityLabel = Literal["LOW", "MEDIUM", "HIGH"]


@dataclass
class LSIMetrics:
    """Structured output for logging, CSV export, or thesis tables."""

    count: int
    image_area_px: float
    sum_bbox_area_px: float
    coverage_fraction: float
    mean_pairwise_centroid_dist_px: float
    count_score: float
    area_score: float
    spread_score: float
    lsi: float
    severity: SeverityLabel

    def as_dict(self) -> Dict[str, Any]:
        return {
            "count": self.count,
            "image_area_px": self.image_area_px,
            "sum_bbox_area_px": self.sum_bbox_area_px,
            "coverage_fraction": self.coverage_fraction,
            "mean_pairwise_centroid_dist_px": self.mean_pairwise_centroid_dist_px,
            "count_score": self.count_score,
            "area_score": self.area_score,
            "spread_score": self.spread_score,
            "lsi": self.lsi,
            "severity": self.severity,
        }


def bbox_area_xyxy(box: Sequence[float]) -> float:
    """Pixel area of one axis-aligned box [x1, y1, x2, y2]."""
    x1, y1, x2, y2 = map(float, box)
    # Ensure positive area even if coordinates are swapped.
    w = max(0.0, x2 - x1)
    h = max(0.0, y2 - y1)
    return w * h


def centroids_xyxy(boxes_xyxy: np.ndarray) -> np.ndarray:
    """
    Compute (N, 2) centroid array from (N, 4) xyxy boxes.
    boxes_xyxy: float array shape (N, 4)
    """
    if boxes_xyxy.size == 0:
        return np.zeros((0, 2), dtype=np.float64)
    x1 = boxes_xyxy[:, 0]
    y1 = boxes_xyxy[:, 1]
    x2 = boxes_xyxy[:, 2]
    y2 = boxes_xyxy[:, 3]
    cx = (x1 + x2) * 0.5
    cy = (y1 + y2) * 0.5
    return np.stack([cx, cy], axis=1)


def mean_pairwise_distance(points: np.ndarray) -> float:
    """
    Mean pairwise Euclidean distance over N points (spread proxy).
    O(N^2); fine for typical litter counts (<100). For N<2 returns 0.
    """
    n = points.shape[0]
    if n < 2:
        return 0.0
    acc = 0.0
    pairs = 0
    for i in range(n):
        for j in range(i + 1, n):
            acc += float(np.linalg.norm(points[i] - points[j]))
            pairs += 1
    return acc / max(pairs, 1)


def image_diagonal(width: int, height: int) -> float:
    """Normalize geometric spreads by image scale."""
    return float(np.hypot(width, height))


def count_score(n: int, cap: int) -> float:
    """
    Map object count to 0–100. Linear ramp until cap, then flat at 100.
    cap: detections at/above this value yield CountScore == 100.
    """
    if cap <= 0:
        return 0.0
    return float(min(100.0, (n / cap) * 100.0))


def area_score_from_coverage(coverage_fraction: float, area_scale: float) -> float:
    """
    coverage_fraction: sum(bbox_areas) / image_area (can exceed 1 if boxes overlap).
    area_scale: multiply fractional coverage to map into 0–100 (then clip).
    """
    raw = float(coverage_fraction) * float(area_scale)
    return float(min(100.0, max(0.0, raw)))


def spread_score_from_distances(
    mean_pairwise_px: float,
    diagonal_px: float,
    spread_denominator: float,
) -> float:
    """
    spread_denominator: larger => harder to reach 100 (tune per camera FOV).
    Uses mean pairwise centroid distance vs a fraction of image diagonal.
    """
    if diagonal_px <= 0 or spread_denominator <= 0:
        return 0.0
    denom = diagonal_px * float(spread_denominator)
    return float(min(100.0, (mean_pairwise_px / denom) * 100.0))


def severity_from_lsi(
    lsi: float,
    low_max: float = 30.0,
    medium_max: float = 60.0,
) -> SeverityLabel:
    """Map LSI to discrete label for dashboards / alerts."""
    if lsi <= low_max:
        return "LOW"
    if lsi <= medium_max:
        return "MEDIUM"
    return "HIGH"


def filter_boxes_outside_bin_polygon(
    boxes_xyxy: np.ndarray,
    bin_polygon: Optional[np.ndarray],
) -> np.ndarray:
    """
    Keep only boxes whose centroid lies OUTSIDE the bin polygon.

    bin_polygon: (K, 2) float or int array, closed or open polygon
                 (OpenCV treats contour as closed).
    If bin_polygon is None, returns boxes unchanged.
    """
    if bin_polygon is None or len(bin_polygon) < 3:
        return boxes_xyxy
    if cv2 is None:
        raise ImportError("filter_boxes_outside_bin_polygon requires opencv-python.")
    poly = np.asarray(bin_polygon, dtype=np.float32).reshape(-1, 1, 2)
    centers = centroids_xyxy(boxes_xyxy)
    keep: List[int] = []
    for i in range(centers.shape[0]):
        x, y = float(centers[i, 0]), float(centers[i, 1])
        # >0 inside, <0 outside, 0 on edge — drop inside-bin (+1) and on-edge (0).
        inside_or_on = cv2.pointPolygonTest(poly, (x, y), measureDist=False)
        if inside_or_on < 0:
            keep.append(i)
    return boxes_xyxy[keep] if keep else np.zeros((0, 4), dtype=boxes_xyxy.dtype)


def compute_lsi(
    boxes_xyxy: np.ndarray,
    image_width: int,
    image_height: int,
    *,
    w_count: float = 0.5,
    w_area: float = 0.3,
    w_spread: float = 0.2,
    count_cap: int = 25,
    area_scale: float = 100.0,
    spread_denominator: float = 0.35,
    low_max: float = 30.0,
    medium_max: float = 60.0,
    bin_polygon: Optional[np.ndarray] = None,
) -> LSIMetrics:
    """
    End-to-end LSI from filtered detections (xyxy, pixel coords).

    boxes_xyxy: (N, 4) array; empty => LSI 0, LOW.
    """
    boxes_xyxy = np.asarray(boxes_xyxy, dtype=np.float64).reshape(-1, 4)
    # Drop in-bin false positives when polygon is provided (research extension).
    boxes_xyxy = filter_boxes_outside_bin_polygon(boxes_xyxy, bin_polygon)

    img_area = float(max(1, image_width) * max(1, image_height))
    n = int(boxes_xyxy.shape[0])

    if n == 0:
        return LSIMetrics(
            count=0,
            image_area_px=img_area,
            sum_bbox_area_px=0.0,
            coverage_fraction=0.0,
            mean_pairwise_centroid_dist_px=0.0,
            count_score=0.0,
            area_score=0.0,
            spread_score=0.0,
            lsi=0.0,
            severity="LOW",
        )

    # Sum of areas (overlap double-counts slightly — acceptable proxy; union is heavier).
    areas = np.array([bbox_area_xyxy(boxes_xyxy[i]) for i in range(n)], dtype=np.float64)
    sum_areas = float(np.sum(areas))
    coverage = sum_areas / img_area

    centers = centroids_xyxy(boxes_xyxy)
    mpd = mean_pairwise_distance(centers)
    diag = image_diagonal(image_width, image_height)

    c_score = count_score(n, count_cap)
    a_score = area_score_from_coverage(coverage, area_scale)
    s_score = spread_score_from_distances(mpd, diag, spread_denominator)

    # Weighted fusion (research formula).
    lsi = w_count * c_score + w_area * a_score + w_spread * s_score
    lsi = float(min(100.0, max(0.0, lsi)))
    sev = severity_from_lsi(lsi, low_max=low_max, medium_max=medium_max)

    return LSIMetrics(
        count=n,
        image_area_px=img_area,
        sum_bbox_area_px=sum_areas,
        coverage_fraction=float(coverage),
        mean_pairwise_centroid_dist_px=float(mpd),
        count_score=float(c_score),
        area_score=float(a_score),
        spread_score=float(s_score),
        lsi=lsi,
        severity=sev,
    )


def load_lsi_config_dict(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten nested YAML-style dict for compute_lsi keyword args."""
    lsi = cfg.get("lsi", {})
    sev = cfg.get("severity", {})
    return {
        "w_count": float(lsi.get("w_count", 0.5)),
        "w_area": float(lsi.get("w_area", 0.3)),
        "w_spread": float(lsi.get("w_spread", 0.2)),
        "count_cap": int(lsi.get("count_cap", 25)),
        "area_scale": float(lsi.get("area_scale", 100.0)),
        "spread_denominator": float(lsi.get("spread_denominator", 0.35)),
        "low_max": float(sev.get("low_max", 30)),
        "medium_max": float(sev.get("medium_max", 60)),
    }


def signage_advisory_for_severity(severity: str) -> Dict[str, Any]:
    """
    Policy hint for municipalities / campus ops: when litter severity is not LOW,
    recommend visible warning signage if the pattern is typical for the site.

    "Consistent" behaviour (same area over time) is enforced in the dashboard UI
    by streaking consecutive MEDIUM/HIGH runs; this function describes the current snapshot only.
    """
    sev = (severity or "").strip().upper()
    if sev in ("HIGH", "MEDIUM"):
        return {
            "warning_signs_recommended": True,
            "headline": "Consider warning signage in this area",
            "detail": (
                "If littering here is often MEDIUM or HIGH, add clear signs (for example "
                "'No littering', 'Use the bin', bilingual where needed) and review bin capacity "
                "and emptying schedules."
            ),
            "for_this_assessment": (
                f"This assessment is {sev}: visible litter pressure. "
                "If this matches what you usually see at this spot, treat signage as a priority."
            ),
        }
    return {
        "warning_signs_recommended": False,
        "headline": "No signage escalation for this snapshot",
        "detail": (
            "Signage campaigns are most cost-effective when levels are repeatedly MEDIUM or HIGH, "
            "not on one-off low readings."
        ),
        "for_this_assessment": "This snapshot is LOW.",
    }


if __name__ == "__main__":
    # Tiny self-test (no images): three boxes spread apart.
    demo = np.array(
        [
            [10, 10, 50, 50],
            [200, 50, 260, 120],
            [400, 300, 500, 400],
        ],
        dtype=np.float64,
    )
    m = compute_lsi(demo, 640, 480)
    print("Demo LSI:", m.as_dict())
