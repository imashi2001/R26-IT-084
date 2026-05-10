"""Hygienic-risk forecaster.

Forecasting in this project is *not* a separate ML model. We replay the
existing rule-based ``compute_risk`` engine for each future weather slot
returned by OpenWeather (or its stub) and emit a small timeline the
dashboard can render.

Assumptions documented for the thesis:
  * The waste label observed at the most recent /analyze stays the same
    in the forecast window. Garbage doesn't typically change category
    until it is cleaned.
  * Animal pressure is treated as the *current* number of detections.
    The forecaster cannot predict new animal arrivals, so it is honest
    about that and exposes the assumption in ``assumptions``.
  * Time-since-clean grows linearly into the future (no model of
    cleaning crews).
"""

from __future__ import annotations

from typing import Any

from risk import compute_risk


def _slot_with_risk(
    slot: dict[str, Any],
    *,
    waste: dict[str, Any] | None,
    animals: list[dict[str, Any]],
    bin_doc: dict[str, Any] | None,
    base_hours_since_clean: float,
    delta_hours: float,
) -> dict[str, Any]:
    projected_bin = dict(bin_doc) if bin_doc else {}
    projected_bin["hours_since_clean"] = round(
        base_hours_since_clean + max(0.0, delta_hours), 2
    )

    risk = compute_risk(
        waste=waste,
        animals=animals,
        weather=slot,
        bin_doc=projected_bin,
    )

    return {
        "ts": slot.get("ts"),
        "ts_unix": slot.get("ts_unix"),
        "temp_c": slot.get("temp_c"),
        "humidity_pct": slot.get("humidity_pct"),
        "condition": slot.get("condition"),
        "level": risk["level"],
        "case": risk["case"],
        "rotting_hours": risk["rotting_hours"],
        "message": risk["message"],
        "source": slot.get("source"),
    }


def _summary(slots: list[dict[str, Any]]) -> dict[str, Any]:
    if not slots:
        return {
            "max_level": None,
            "first_high_at": None,
            "first_medium_at": None,
            "recommendation": "Not enough forecast data.",
        }

    rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    max_slot = max(slots, key=lambda s: rank.get(s["level"], 0))
    first_high = next((s for s in slots if s["level"] in ("HIGH", "CRITICAL")), None)
    first_medium = next((s for s in slots if s["level"] == "MEDIUM"), None)

    if first_high:
        recommendation = (
            f"Schedule cleaning before {first_high['ts']} — risk is forecast "
            f"to reach {first_high['level']}."
        )
    elif first_medium:
        recommendation = (
            f"Risk likely to reach MEDIUM by {first_medium['ts']}. "
            "Inspect within the next shift."
        )
    else:
        recommendation = "Risk stays LOW for the forecast window. No action required."

    return {
        "max_level": max_slot["level"],
        "max_level_at": max_slot["ts"],
        "first_high_at": first_high["ts"] if first_high else None,
        "first_medium_at": first_medium["ts"] if first_medium else None,
        "recommendation": recommendation,
    }


def forecast_risk(
    *,
    forecast_slots: list[dict[str, Any]],
    waste: dict[str, Any] | None,
    animals: list[dict[str, Any]] | None,
    bin_doc: dict[str, Any] | None,
) -> dict[str, Any]:
    """Project the rule-based risk forward over OpenWeather slots."""
    animals = animals or []
    base_hours = float((bin_doc or {}).get("hours_since_clean", 0.0))

    slots: list[dict[str, Any]] = []
    for slot in forecast_slots:
        delta = (slot.get("ts_unix", 0) - (forecast_slots[0].get("ts_unix") or 0)) / 3600.0
        slots.append(
            _slot_with_risk(
                slot,
                waste=waste,
                animals=animals,
                bin_doc=bin_doc,
                base_hours_since_clean=base_hours,
                delta_hours=delta + 3.0,
            )
        )

    return {
        "slots": slots,
        "summary": _summary(slots),
        "assumptions": [
            "Waste type stays the same until the bin is cleaned.",
            "Animal pressure is held at the latest /analyze observation.",
            "Time since last clean grows linearly into the future.",
        ],
    }
