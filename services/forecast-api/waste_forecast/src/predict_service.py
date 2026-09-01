"""Shared XGBoost row prediction (Adheeshana forecasting core).

Used by:
  - services/forecast-api (Railway)
  - forecasting dashboard/run_model.py (local Node fallback)
  - forecasting dashboard/_run_trend.py
"""

from __future__ import annotations

from typing import Any

try:
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES, CATEGORY_SHARES
except ImportError:
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES, CATEGORY_SHARES

SEASONAL_MULTIPLIERS = {
    "Moratuwa_December": 1.25,
    "Poya_Day_Unburnable": 1.20,
    "Poya_Day_SOW": 1.15,
    "Poya_Day_Burnable": 1.15,
}


def identify_institute_id(row: dict) -> str:
    if row.get("Institute_Dehiwala - Mt Lavinia") == 1:
        return "dehiwala-mtlavinia"
    if row.get("Institute_Moratuwa M.C.") == 1:
        return "moratuwa-mc"
    if row.get("Institute_Sri J,puraKotte M.C.") == 1:
        return "kotte-mc"
    if row.get("Institute_Maharagama U.C.") == 1:
        return "maharagama-uc"
    if row.get("Institute_Kesbewa U.C.") == 1:
        return "kesbewa-uc"
    if row.get("Institute_Homagama P.S.") == 1:
        return "homagama-ps"
    if row.get("Institute_Kothalawala Defence University") == 1:
        return "kdu-campus"
    return "boralesgamuwa-uc"


def identify_category_name(row: dict) -> str:
    if row.get("Category_Burnable") == 1:
        return "Burnable"
    if row.get("Category_SOW") == 1:
        return "SOW"
    if row.get("Category_Unburnable") == 1:
        return "Unburnable"
    if row.get("Category_Sanitary Waste") == 1:
        return "Sanitary Waste"
    if row.get("Category_Industrial Waste") == 1:
        return "Industrial Waste"
    if row.get("Category_Slaughter House Waste") == 1:
        return "Slaughter House Waste"
    if row.get("Category_C & D") == 1:
        return "C & D"
    return "Bulky Waste"


def apply_adjustments_kg(base_kg: float, row: dict) -> float:
    val = max(0.0, float(base_kg))
    if row.get("Is_Weekend") == 1 or row.get("Is_Long_Weekend") == 1:
        val *= 1.5
    if row.get("Month") == 12 and row.get("Institute_Moratuwa M.C.") == 1:
        val *= SEASONAL_MULTIPLIERS["Moratuwa_December"]
    if row.get("Is_Poya_Day") == 1:
        if row.get("Category_Unburnable") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_Unburnable"]
        elif row.get("Category_SOW") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_SOW"]
        elif row.get("Category_Burnable") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_Burnable"]
    return val


def predict_rows(rows: list[dict], *, mode: str = "auto") -> dict[str, Any]:
    """Run location/category disaggregation for feature rows → KG predictions."""
    if not rows:
        raise ValueError("rows must be a non-empty list")

    if mode == "trend":
        predictions: list[float] = []
        for row in rows:
            date_str = row.get("dateStr")
            if not date_str:
                month = int(row.get("Month") or 1)
                date_str = f"2025-{month:02d}-15"
            daily_res = estimate_daily_waste(date_str, mode="forecast")
            base_daily_tons = float(daily_res["estimated_daily_waste"])
            inst_id = identify_institute_id(row)
            cat_name = identify_category_name(row)
            inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
            cat_share = CATEGORY_SHARES.get(cat_name, 0.045)
            item_base_tons = base_daily_tons * inst_share * cat_share
            kg = apply_adjustments_kg(item_base_tons * 1000.0, row)
            predictions.append(round(kg, 4))
        return {
            "predictions": predictions,
            "reliability": "reliable",
            "reliabilityNote": "",
        }

    first = rows[0]
    date_str = first.get("dateStr")
    if not date_str:
        month = int(first.get("Month") or 1)
        date_str = f"2025-{month:02d}-15"

    daily_res = estimate_daily_waste(date_str, mode=mode)
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    predictions = []
    for row in rows:
        inst_id = identify_institute_id(row)
        cat_name = identify_category_name(row)
        inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
        cat_share = CATEGORY_SHARES.get(cat_name, 0.045)
        item_base_tons = base_daily_tons * inst_share * cat_share
        kg = apply_adjustments_kg(item_base_tons * 1000.0, row)
        predictions.append(round(kg, 4))

    return {
        "predictions": predictions,
        "reliability": daily_res.get("reliability", "reliable"),
        "reliabilityNote": daily_res.get("reliability_note", ""),
    }
