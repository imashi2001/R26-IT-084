"""Rule-based hygiene risk engine.

Risk is decided by **explicit cases** the user can read off the dashboard,
not a hidden weighted score. Each call returns the level, a human-readable
message, the list of rules that fired, the rotting estimate, and a preset
alert string for the UI.

Cases (matches the spec):
  CASE 3 (HIGH)   : organic waste + at least one animal detection
  CASE 2 (MEDIUM) : organic waste + high temperature AND high humidity, no animals
  CASE 1 (LOW)    : organic waste, no animals, normal weather
  Extra (HIGH)    : non-organic + animals (animals are still a hygiene hazard)
  Extra (LOW)     : non-organic, no animals (no urgent rotting concern)

CASE 4 (CRITICAL / mixed waste + animals) is intentionally not implemented:
the current waste classifier is binary (organic vs non-organic), so we cannot
honestly detect "mixed" waste from one image. Documented as future work.
"""

from __future__ import annotations

import os
from typing import Any

from .rotting import estimate_rotting_hours

HIGH_TEMP_C = float(os.environ.get("HIGH_TEMP_C", "30"))
HIGH_HUMIDITY_PCT = float(os.environ.get("HIGH_HUMIDITY_PCT", "75"))

LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")

ALERT_TEXT = {
    "LOW": "Organic waste detected. No immediate hygienic danger.",
    "MEDIUM": "Organic waste may rot soon due to environmental conditions.",
    "HIGH": "Animal activity detected near garbage bin.",
    "CRITICAL": "Immediate cleaning required. High hygienic risk detected.",
}


def _format_rotting_summary(hours: float | None, waste_label: str | None) -> str:
    if hours is None:
        return "Estimated rotting time: N/A (non-organic waste)"
    if hours <= 0:
        return "Estimated rotting time: organic waste likely already rotting"
    if hours < 1:
        return "Estimated rotting time: less than 1 hour"
    if hours <= 48:
        return f"Estimated rotting time: ~{hours:.0f} hours"
    days = hours / 24.0
    return f"Estimated rotting time: ~{days:.1f} days"


def _animal_summary(animals: list[dict[str, Any]]) -> str:
    if not animals:
        return ""
    kinds = sorted({(a.get("class_name") or "?").lower() for a in animals})
    return ", ".join(kinds)


def compute_risk(
    *,
    waste: dict[str, Any] | None,
    animals: list[dict[str, Any]] | None,
    weather: dict[str, Any] | None,
    bin_doc: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Decide a risk level for one observation.

    Inputs are loose dicts so the API layer doesn't need pydantic models.
    Backwards compatible with the previous engine (still returns
    ``level`` and ``message``) but adds ``rules_fired``, ``alerts``,
    ``rotting_summary`` and a ``case`` label.
    """
    animals = animals or []
    waste_label = ((waste or {}).get("label") or "").lower() or None
    is_organic = waste_label == "organic"
    has_animal = len(animals) > 0
    no_animal_attacks = not has_animal

    temp_c = float((weather or {}).get("temp_c", 25.0))
    hum_pct = float((weather or {}).get("humidity_pct", 50.0))

    high_temp = temp_c >= HIGH_TEMP_C
    high_hum = hum_pct >= HIGH_HUMIDITY_PCT

    rules_fired: list[str] = []
    case: str
    level: str
    message: str
    bin_name = (bin_doc or {}).get("name") or "the bin"

    if is_organic and has_animal:
        case = "CASE_3"
        level = "HIGH"
        rules_fired.append("organic_waste_with_animal_activity")
        kinds = _animal_summary(animals) or "animal"
        message = (
            f"High hygienic risk detected. {kinds.capitalize()} interacting with "
            f"garbage near {bin_name}. Immediate cleaning required."
        )
    elif (not is_organic) and has_animal:
        case = "EXTRA_NONORGANIC_WITH_ANIMAL"
        level = "HIGH"
        rules_fired.append("non_organic_with_animal_activity")
        kinds = _animal_summary(animals) or "animal"
        message = (
            f"High hygienic risk: {kinds} interacting with non-organic garbage "
            f"near {bin_name}. Clean and remove waste promptly."
        )
    elif is_organic and high_temp and high_hum:
        case = "CASE_2"
        level = "MEDIUM"
        rules_fired.append("organic_high_temp_and_humidity")
        rules_fired.append(f"temp_{temp_c:.1f}C_ge_{HIGH_TEMP_C:.0f}C")
        rules_fired.append(f"humidity_{hum_pct:.0f}pct_ge_{HIGH_HUMIDITY_PCT:.0f}pct")
        message = (
            "Organic waste may rot quickly due to high temperature and humidity. "
            "Schedule cleaning soon."
        )
    elif is_organic:
        case = "CASE_1"
        level = "LOW"
        rules_fired.append("organic_waste_only")
        if no_animal_attacks:
            rules_fired.append("no_animal_attacks")
        message = (
            "Organic waste detected. No animal attacks identified. Current "
            "hygienic risk level is LOW."
        )
    else:
        case = "EXTRA_NONORGANIC_CLEAR"
        level = "LOW"
        rules_fired.append("non_organic_no_animals")
        if no_animal_attacks:
            rules_fired.append("no_animal_attacks")
        message = (
            "Non-organic waste detected. No animal attacks identified. No "
            "immediate hygienic danger."
        )

    rotting_hours = estimate_rotting_hours(
        waste_label=waste_label,
        temp_c=temp_c,
        humidity_pct=hum_pct,
        hours_since_clean=float((bin_doc or {}).get("hours_since_clean", 0)),
    )
    rotting_summary = _format_rotting_summary(rotting_hours, waste_label)

    return {
        "case": case,
        "level": level,
        "message": message,
        "rules_fired": rules_fired,
        "alert": ALERT_TEXT.get(level, ""),
        "no_animal_attacks": no_animal_attacks,
        "rotting_hours": rotting_hours,
        "rotting_summary": rotting_summary,
        "thresholds": {
            "HIGH_TEMP_C": HIGH_TEMP_C,
            "HIGH_HUMIDITY_PCT": HIGH_HUMIDITY_PCT,
        },
        "inputs": {
            "waste_label": waste_label,
            "animal_count": len(animals),
            "animal_classes": sorted(
                {(a.get("class_name") or "?").lower() for a in animals}
            ),
            "temp_c": temp_c,
            "humidity_pct": hum_pct,
            "high_temp": high_temp,
            "high_humidity": high_hum,
        },
        "case4_note": (
            "CRITICAL (mixed organic + non-organic + animals) is documented as "
            "future work. The current waste model is binary, so 'mixed' waste "
            "cannot be inferred from a single image."
        ),
    }
