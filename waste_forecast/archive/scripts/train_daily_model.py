"""Train a separate daily model from the project's daily-equivalent data.

The repository does not currently contain measured daily historical targets.
This script reconstructs daily targets by applying the checked-in daily profile
shares to each historical monthly total. The production monthly model is never
read or modified.
"""

from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path
import sys

# Archived script: live modules it imports are in waste_forecast/src/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

try:
    from calendar_features import build_daily_calendar
    from load_data import load_waste_data
except ImportError:  # pragma: no cover
    from src.calendar_features import build_daily_calendar
    from src.load_data import load_waste_data

ROOT = Path(__file__).resolve().parents[3]  # archive/scripts -> repo root
FORECAST_ROOT = ROOT / "waste_forecast"
# Retired daily model; written to archive/ so models/ holds only the live trend model.
MODEL_PATH = FORECAST_ROOT / "archive" / "trained_model_daily.pkl"
DATA_PATH = FORECAST_ROOT / "evaluation" / "daily_dataset.csv"
SEED = 42


def build_daily_dataset() -> tuple[pd.DataFrame, list[str]]:
    _, monthly = load_waste_data(ROOT)
    profile_path = FORECAST_ROOT / "models" / "daily_profile.json"
    with profile_path.open("r", encoding="utf-8") as handle:
        profile = json.load(handle)
    profile_rows = [row for rows in profile["months"].values() for row in rows]
    daily_profile = pd.DataFrame(profile_rows)
    daily_profile["date"] = pd.to_datetime(daily_profile["date"])
    daily_profile["year"] = daily_profile["date"].dt.year
    daily_profile["month"] = daily_profile["date"].dt.month
    monthly["date"] = pd.to_datetime(monthly["date"])
    daily = daily_profile.merge(monthly[["year", "month", "waste_tons"]], on=["year", "month"], how="inner")
    daily["actual"] = daily["waste_tons"] * daily["daily_share"]

    calendar = build_daily_calendar(
        start_date=daily["date"].min().strftime("%Y-%m-%d"),
        end_date=daily["date"].max().strftime("%Y-%m-%d"),
    )
    daily = daily.merge(calendar, on=["date", "year", "month"], how="left").sort_values("date").reset_index(drop=True)
    daily["lag_1"] = daily["actual"].shift(1)
    daily["lag_7"] = daily["actual"].shift(7)
    daily["lag_14"] = daily["actual"].shift(14)
    daily["rolling_mean_7"] = daily["actual"].shift(1).rolling(7, min_periods=7).mean()
    daily["rolling_std_7"] = daily["actual"].shift(1).rolling(7, min_periods=7).std().fillna(0)
    daily["day_of_week_num"] = daily["date"].dt.dayofweek
    daily["day_sin"] = np.sin(2 * np.pi * daily["day_of_week_num"] / 7)
    daily["day_cos"] = np.cos(2 * np.pi * daily["day_of_week_num"] / 7)
    daily["month_sin"] = np.sin(2 * np.pi * daily["month"] / 12)
    daily["month_cos"] = np.cos(2 * np.pi * daily["month"] / 12)
    feature_columns = [
        "lag_1", "lag_7", "lag_14", "rolling_mean_7", "rolling_std_7",
        "day_of_week_num", "day_sin", "day_cos", "month_sin", "month_cos",
        "is_weekend", "is_holiday", "is_off_day", "is_long_weekend",
        "is_long_weekend_bridge", "n_long_weekend_days", "n_bridge_days",
    ]
    before = len(daily)
    daily = daily.dropna(subset=feature_columns + ["actual"]).reset_index(drop=True)
    daily.attrs["rows_dropped"] = before - len(daily)
    return daily, feature_columns


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-path", type=Path, default=MODEL_PATH)
    args = parser.parse_args()
    np.random.seed(SEED)
    daily, feature_columns = build_daily_dataset()
    args.model_path.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    daily.to_csv(DATA_PATH, index=False)
    model = HistGradientBoostingRegressor(
        max_iter=200, learning_rate=0.05, max_leaf_nodes=15,
        l2_regularization=0.1, random_state=SEED,
    )
    model.fit(daily[feature_columns], daily["actual"])
    with args.model_path.open("wb") as handle:
        pickle.dump({"model": model, "feature_columns": feature_columns, "seed": SEED}, handle)
    print(f"Saved daily dataset: {DATA_PATH} ({len(daily)} rows; dropped {daily.attrs['rows_dropped']} warm-up rows)")
    print(f"Saved daily model: {args.model_path}")


if __name__ == "__main__":
    main()