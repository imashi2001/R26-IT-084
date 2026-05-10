"""Rotting-time estimator.

Pure function: given waste type and environmental conditions, estimate
how many hours of headroom remain before organic waste becomes a
hygiene problem.

Calibration anchors (rough, deliberately explainable):
  - 25 °C, 50 % RH, fresh organic  -> ~36 h baseline
  - 35 °C, 90 % RH                  -> baseline shrinks to ~7 h
  - non-organic                     -> None (does not "rot")
"""

from __future__ import annotations


BASELINE_HOURS = 36.0


def estimate_rotting_hours(
    waste_label: str | None,
    temp_c: float | None,
    humidity_pct: float | None,
    hours_since_clean: float = 0.0,
) -> float | None:
    if not waste_label or waste_label.lower() != "organic":
        return None

    t = float(temp_c) if temp_c is not None else 25.0
    h = float(humidity_pct) if humidity_pct is not None else 50.0

    heat_factor = max(1.0, 1.0 + 0.07 * (t - 25.0))
    hum_factor = max(1.0, 1.0 + 0.015 * (h - 50.0))

    total_window = BASELINE_HOURS / (heat_factor * hum_factor)
    remaining = total_window - max(0.0, float(hours_since_clean))
    return max(0.0, round(remaining, 1))
