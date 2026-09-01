from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

try:
    from calendar_features import build_daily_calendar
    from load_data import load_waste_data
except ImportError:
    from src.calendar_features import build_daily_calendar
    from src.load_data import load_waste_data

WORKSPACE_ROOT = Path(
    os.environ.get("WORKSPACE_ROOT", Path(__file__).resolve().parents[2])
)
MODEL_PATH = WORKSPACE_ROOT / "waste_forecast" / "models" / "model.json"
FEATURE_COLUMNS_PATH = WORKSPACE_ROOT / "waste_forecast" / "models" / "feature_columns.json"
PROFILE_PATH = WORKSPACE_ROOT / "waste_forecast" / "models" / "daily_profile.json"

# Maximum reliable forecast horizon: 12 months beyond historical training cutoff (2025-12-31)
RELIABLE_HORIZON_START = "2023-01-01"
RELIABLE_HORIZON_END = "2026-12-31"


def _load_feature_columns() -> list[str]:
    with open(FEATURE_COLUMNS_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _load_daily_profile() -> list[dict[str, object]]:
    with open(PROFILE_PATH, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    records = []
    sample_months = payload.get("sample_months", {})
    for m_records in sample_months.values():
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


def _get_monthly_features_dict(target_year: int, target_month: int) -> dict[str, object]:
    month_calendar = build_daily_calendar(start_date=f"{target_year}-01-01", end_date=f"{target_year}-12-31")
    month_row = month_calendar[(month_calendar["year"] == target_year) & (month_calendar["month"] == target_month)].reset_index(drop=True)

    monthly_features = month_row.groupby(["year", "month"], as_index=False).agg(
        n_weekend_days=("is_weekend", "sum"),
        n_holidays=("is_holiday", "sum"),
        n_off_days=("is_off_day", "sum"),
        n_long_weekend_days=("is_long_weekend", "sum"),
        n_long_weekend_events=("is_long_weekend", "sum"),
        max_long_weekend_length=("long_weekend_length", "max"),
        n_poya_days=("holiday_name", lambda s: int(s.str.contains("Poya", case=False, na=False).sum())),
        n_bridge_days=("is_long_weekend_bridge", "sum"),
        working_days=("is_off_day", lambda s: int((~s).sum())),
    )
    return monthly_features.iloc[0].to_dict()


def _forecast_monthly_total_for_date(target_date: pd.Timestamp) -> float:
    """Walk-forward forecast month-by-month from last historical point (2025-12) to target_date.

    Lag features (lag_1, lag_2, lag_3) chain forward dynamically from previous actual/predicted totals.
    """
    month_total = _monthly_actual_total_for_date(target_date)
    if month_total is not None:
        return month_total

    _, total_history = load_waste_data(WORKSPACE_ROOT)
    history = total_history.sort_values(["year", "month"]).reset_index(drop=True)

    # Dictionary mapping (year, month) tuple -> waste_tons
    known_totals: dict[tuple[int, int], float] = {}
    for _, row in history.iterrows():
        known_totals[(int(row["year"]), int(row["month"]))] = float(row["waste_tons"])

    feature_columns = _load_feature_columns()
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    # Walk forward month by month from 2026-01 up to target_date
    start_year, start_month = 2026, 1
    target_year, target_month = int(target_date.year), int(target_date.month)

    curr_year, curr_month = start_year, start_month

    while (curr_year < target_year) or (curr_year == target_year and curr_month <= target_month):
        if (curr_year, curr_month) not in known_totals:
            # Look up previous 3 months in known_totals
            def prev_ym(y, m, offset):
                total_m = y * 12 + (m - 1) - offset
                py = total_m // 12
                pm = (total_m % 12) + 1
                return py, pm

            lags = []
            for k in [1, 2, 3]:
                py, pm = prev_ym(curr_year, curr_month, k)
                val = known_totals.get((py, pm), 29.0)  # Default fallback 29.0 if missing
                lags.append(val)

            rolling_mean = float(np.mean(lags))
            rolling_std = float(np.std(lags, ddof=0)) if len(lags) >= 2 else 0.0

            monthly_feats = _get_monthly_features_dict(curr_year, curr_month)

            feature_map = {
                "lag_1": lags[0],
                "lag_2": lags[1],
                "lag_3": lags[2],
                "rolling_mean_3": rolling_mean,
                "rolling_std_3": rolling_std,
                "n_weekend_days": int(monthly_feats["n_weekend_days"]),
                "n_holidays": int(monthly_feats["n_holidays"]),
                "n_off_days": int(monthly_feats["n_off_days"]),
                "n_long_weekend_days": int(monthly_feats["n_long_weekend_days"]),
                "n_long_weekend_events": int(monthly_feats["n_long_weekend_events"]),
                "max_long_weekend_length": int(monthly_feats["max_long_weekend_length"]),
                "n_poya_days": int(monthly_feats["n_poya_days"]),
                "n_bridge_days": int(monthly_feats["n_bridge_days"]),
                "working_days": int(monthly_feats["working_days"]),
                "month_sin": float(np.sin(2 * np.pi * curr_month / 12)),
                "month_cos": float(np.cos(2 * np.pi * curr_month / 12)),
                "quarter": int(((curr_month - 1) // 3) + 1),
            }

            row = pd.DataFrame([feature_map], columns=feature_columns)
            pred = float(model.predict(row)[0])
            if pred > 500.0:  # model emits KG, convert to metric tons for consistent lag chaining
                pred = pred / 1000.0
            known_totals[(curr_year, curr_month)] = pred

        if curr_month == 12:
            curr_year += 1
            curr_month = 1
        else:
            curr_month += 1

    return known_totals.get((target_year, target_month), 29.2)


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
        source = "model_walkforward_forecast"

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
