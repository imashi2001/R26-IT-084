from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

try:
    from calendar_features import build_daily_calendar
    from load_data import load_waste_data
    from trend_model import WeightedTrendModel
except ImportError:
    from src.calendar_features import build_daily_calendar
    from src.load_data import load_waste_data
    from src.trend_model import WeightedTrendModel

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
TREND_MODEL_PATH = WORKSPACE_ROOT / "waste_forecast" / "models" / "trend_model.json"
PROFILE_PATH = WORKSPACE_ROOT / "waste_forecast" / "models" / "daily_profile.json"

# Maximum reliable forecast horizon: 12 months beyond historical training cutoff (2025-12-31)
RELIABLE_HORIZON_START = "2023-01-01"
RELIABLE_HORIZON_END = "2026-12-31"


def _load_daily_profile() -> list[dict[str, object]]:
    with open(PROFILE_PATH, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    # "months" holds every day of every profiled month. "sample_months" is only a
    # five-day preview of two months; reading it made every other date miss the
    # lookup and fall back to a uniform 1/days_in_month share, silently dropping
    # the day_weight calendar effect.
    records = []
    for m_records in payload.get("months", {}).values():
        records.extend(m_records)
    return records


def _monthly_actual_total_for_date(target_date: pd.Timestamp) -> float | None:
    _, total_history = load_waste_data(WORKSPACE_ROOT)
    match = total_history[
        (total_history["year"] == target_date.year) & (total_history["month"] == target_date.month)
    ]
    if not match.empty:
        return float(match.iloc[0]["waste_tons"])
    return None


def _forecast_monthly_total_for_date(target_date: pd.Timestamp) -> float:
    """Forecast a monthly total directly with the full real-data trend model."""
    month_total = _monthly_actual_total_for_date(target_date)
    if month_total is not None:
        return month_total

    if not TREND_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Production trend model was not found at {TREND_MODEL_PATH}. "
            "Run waste_forecast/src/fit_production_model.py before serving forecasts."
        )

    model = WeightedTrendModel.load(TREND_MODEL_PATH)
    print(
        f"[daily_forecast] loaded model file={TREND_MODEL_PATH} "
        "type=weighted_ols_trend_with_unweighted_month_effects",
        file=sys.stderr,
    )

    if model.origin_year_month is None:
        raise ValueError(
            "Loaded trend model has no training origin. "
            "Re-run waste_forecast/src/fit_production_model.py."
        )
    first_month = pd.Period(model.origin_year_month, freq="M")
    target_period = pd.Period(target_date, freq="M")
    target_index = int(target_period.ordinal - first_month.ordinal)
    pred = float(model.predict([int(target_date.month)], [target_index])[0])

    if pred < 1000.0 or pred > 100000.0:
        message = (
            "[daily_forecast] Predicted monthly total outside sane metric-ton band: "
            f"value={pred:.3f} tons, year={target_date.year}, month={target_date.month}"
        )
        print(message, file=sys.stderr)
        raise ValueError(message)

    return pred


def is_date_within_reliable_horizon(date_value: str | pd.Timestamp) -> tuple[bool, str]:
    ts = pd.Timestamp(date_value).normalize()
    start_ts = pd.Timestamp(RELIABLE_HORIZON_START)
    end_ts = pd.Timestamp(RELIABLE_HORIZON_END)
    if ts < start_ts or ts > end_ts:
        return False, f"Date {ts.strftime('%Y-%m-%d')} is outside reliable horizon ({RELIABLE_HORIZON_START} to {RELIABLE_HORIZON_END})"
    return True, "reliable"


def estimate_daily_waste(date_value: str | pd.Timestamp, mode: str = "auto", override_monthly_total: float | None = None) -> dict[str, object]:
    target_date = pd.Timestamp(date_value).normalize()
    target_date_str = target_date.strftime("%Y-%m-%d")

    reliable, reliability_reason = is_date_within_reliable_horizon(target_date)

    # Clamp date if outside reliable horizon
    clamped_date = target_date
    if target_date > pd.Timestamp(RELIABLE_HORIZON_END):
        clamped_date = pd.Timestamp(RELIABLE_HORIZON_END)
    elif target_date < pd.Timestamp(RELIABLE_HORIZON_START):
        clamped_date = pd.Timestamp(RELIABLE_HORIZON_START)

    eval_date = clamped_date if not reliable else target_date
    eval_date_str = eval_date.strftime("%Y-%m-%d")

    actual_total = _monthly_actual_total_for_date(eval_date)
    if mode == "auto":
        mode_name = "actual" if actual_total is not None else "forecast"
    else:
        mode_name = mode

    if override_monthly_total is not None:
        monthly_total_tons = float(override_monthly_total)
        source = "override"
    elif mode_name == "actual":
        monthly_total_tons = actual_total if actual_total is not None else _forecast_monthly_total_for_date(eval_date)
        source = "historical_actual"
    else:
        monthly_total_tons = _forecast_monthly_total_for_date(eval_date)
        source = "weighted_trend_model_full_real_history"

    profile_records = _load_daily_profile()
    profile_lookup = {r["date"]: r for r in profile_records}

    rec = profile_lookup.get(eval_date_str)
    if rec is None:
        # Fallback uniform share if not found in profile
        days_in_month = pd.Period(eval_date_str).days_in_month
        daily_share = 1.0 / float(days_in_month)
        day_type = "weekday"
        day_weight = 1.0
    else:
        daily_share = float(rec["daily_share"])
        day_type = str(rec["day_type"])
        day_weight = float(rec["day_weight"])

    estimated_daily_waste = monthly_total_tons * daily_share

    return {
        "requested_date": target_date_str,
        "evaluated_date": eval_date_str,
        "year": int(eval_date.year),
        "month": int(eval_date.month),
        "day": int(eval_date.day),
        "day_type": day_type,
        "day_weight": day_weight,
        "monthly_total_waste_tons": monthly_total_tons,
        "monthly_total_source": source,
        "daily_share": daily_share,
        "daily_share_pct": daily_share * 100.0,
        "estimated_daily_waste": estimated_daily_waste,
        "reliability": "reliable" if reliable else "out_of_range",
        "reliability_note": reliability_reason if not reliable else "Within 12-month reliable horizon (2023-01 to 2026-12)",
    }
