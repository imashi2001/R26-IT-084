from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

try:
    from src.calendar_features import build_daily_calendar
    from src.load_data import load_waste_data
except ImportError:  # pragma: no cover
    from calendar_features import build_daily_calendar
    from load_data import load_waste_data

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
MODEL_PATH = PROJECT_ROOT / "models" / "model.json"
FEATURE_COLUMNS_PATH = PROJECT_ROOT / "models" / "feature_columns.json"
PROFILE_PATH = PROJECT_ROOT / "models" / "daily_profile.json"


def get_day_type_for_date(date: pd.Timestamp | str) -> str:
    target = pd.Timestamp(date).normalize()
    daily = build_daily_calendar(start_date="2023-01-01", end_date="2025-12-31")
    row = daily[daily["date"] == target]
    if row.empty:
        # Future-date calendar coverage is still available via the holiday cache, so build the needed years dynamically.
        future_start = pd.Timestamp("2026-01-01")
        future_end = pd.Timestamp("2027-12-31")
        future_daily = build_daily_calendar(start_date=future_start.strftime("%Y-%m-%d"), end_date=future_end.strftime("%Y-%m-%d"))
        row = future_daily[future_daily["date"] == target]
    if row.empty:
        raise ValueError(f"No calendar row found for {target.date()}.")

    if bool(row.iloc[0]["is_long_weekend_bridge"]):
        return "bridge_day"
    if bool(row.iloc[0]["is_long_weekend"]):
        return "long_weekend"
    if bool(row.iloc[0]["is_holiday"]):
        return "holiday"
    if bool(row.iloc[0]["is_weekend"]):
        return "weekend"
    return "weekday"


def _load_profile() -> dict[str, object]:
    with open(PROFILE_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _load_feature_columns() -> list[str]:
    with open(FEATURE_COLUMNS_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _monthly_actual_total_for_date(target_date: pd.Timestamp) -> float | None:
    _, total_all = load_waste_data(WORKSPACE_ROOT)
    if total_all.empty:
        return None
    month_key = (target_date.year, target_date.month)
    match = total_all[(total_all["year"] == month_key[0]) & (total_all["month"] == month_key[1])]
    if match.empty:
        return None
    value = float(match.iloc[0]["waste_tons"])
    return value


def _forecast_monthly_total_for_date(target_date: pd.Timestamp) -> float:
    month_total = _monthly_actual_total_for_date(target_date)
    if month_total is not None:
        return month_total

    _, total_history = load_waste_data(WORKSPACE_ROOT)
    target_year = int(target_date.year)
    target_month = int(target_date.month)
    month_calendar = build_daily_calendar(start_date=f"{target_year}-01-01", end_date=f"{target_year}-12-31")
    month_row = month_calendar[(month_calendar["year"] == target_year) & (month_calendar["month"] == target_month)].copy()
    month_row = month_row.reset_index(drop=True)

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
    monthly_feats = monthly_features.iloc[0].to_dict()

    # This is a minimal, approximate monthly forecast using the trained model and the available historical total history.
    history = total_history.sort_values(["year", "month"]).reset_index(drop=True)
    prior = history[(history["date"] < target_date)].tail(3)
    lag_values = [float(prior.iloc[-1]["waste_tons"]) if len(prior) >= 1 else np.nan,
                  float(prior.iloc[-2]["waste_tons"]) if len(prior) >= 2 else np.nan,
                  float(prior.iloc[-3]["waste_tons"]) if len(prior) >= 3 else np.nan]

    rolling_values = prior["waste_tons"].tail(3).tolist()
    rolling_mean = float(np.mean(rolling_values)) if rolling_values else 0.0
    rolling_std = float(np.std(rolling_values, ddof=0)) if len(rolling_values) >= 2 else 0.0

    feature_map = {
        "lag_1": lag_values[0],
        "lag_2": lag_values[1],
        "lag_3": lag_values[2],
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
        "month_sin": float(np.sin(2 * np.pi * target_month / 12)),
        "month_cos": float(np.cos(2 * np.pi * target_month / 12)),
        "quarter": int(((target_month - 1) // 3) + 1),
    }

    feature_columns = _load_feature_columns()
    row = pd.DataFrame([feature_map], columns=feature_columns)
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))
    return float(model.predict(row)[0])


def estimate_daily_waste(date_value: str | pd.Timestamp, mode: str = "auto", override_monthly_total: float | None = None) -> dict[str, object]:
    target_date = pd.Timestamp(date_value).normalize()
    target_date_str = target_date.strftime("%Y-%m-%d")

    actual_total = _monthly_actual_total_for_date(target_date)
    if mode == "auto":
        mode_name = "actual" if actual_total is not None else "forecast"
    else:
        mode_name = mode

    if override_monthly_total is not None:
        monthly_total = float(override_monthly_total)
        monthly_total_source = "forecast" if mode_name == "forecast" else "actual"
    elif mode_name == "actual":
        if actual_total is None:
            raise ValueError(f"No known actual monthly total for {target_date_str}.")
        monthly_total = float(actual_total)
        monthly_total_source = "actual"
    else:
        monthly_total = _forecast_monthly_total_for_date(target_date)
        monthly_total_source = "forecast"

    profile = _load_profile()["months"]
    month_key = f"{target_date.year}-{target_date.month:02d}"
    month_entries = profile.get(month_key, [])
    if not month_entries:
        raise ValueError(f"No daily profile available for {month_key}.")

    match_row = next((d for d in month_entries if d["date"] == target_date_str), None)
    if match_row is None:
        raise ValueError(f"No daily profile entry for {target_date_str}.")

    day_type = match_row["day_type"]
    daily_share = float(match_row["daily_share"])
    estimated = monthly_total * daily_share
    return {
        "date": target_date_str,
        "day_type": day_type,
        "monthly_total_used": float(monthly_total),
        "monthly_total_source": monthly_total_source,
        "estimated_daily_waste": float(estimated),
        "daily_share_pct": float(daily_share * 100.0),
        "note": "Daily estimate derived from monthly forecast disaggregated by assumed day-type weights; not a true daily-trained model.",
    }


def estimate_date_range(start_date: str, end_date: str, mode: str = "auto") -> list[dict[str, object]]:
    start = pd.Timestamp(start_date).normalize()
    end = pd.Timestamp(end_date).normalize()
    result: list[dict[str, object]] = []
    for date_value in pd.date_range(start=start, end=end, freq="D"):
        result.append(estimate_daily_waste(date_value, mode=mode))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Estimate a daily waste figure by disaggregating a monthly total using a day-type profile.")
    parser.add_argument("--date", help="Single date to estimate, e.g. 2026-04-14")
    parser.add_argument("--start-date", help="Optional start date for a date range")
    parser.add_argument("--end-date", help="Optional end date for a date range")
    parser.add_argument("--mode", choices=["auto", "actual", "forecast"], default="auto", help="actual uses known actual monthly totals; forecast uses the saved monthly model.")
    args = parser.parse_args()

    if args.date and not args.start_date and not args.end_date:
        print(json.dumps(estimate_daily_waste(args.date, mode=args.mode), indent=2))
    elif args.start_date or args.end_date:
        start = args.start_date or args.date
        end = args.end_date or args.date
        print(json.dumps(estimate_date_range(start, end, mode=args.mode), indent=2))
    else:
        raise ValueError("Provide --date for a single day or --start-date/--end-date for a date range.")


if __name__ == "__main__":
    main()
