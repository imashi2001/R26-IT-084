"""Build the measured monthly forecasting dataset."""

from __future__ import annotations

from pathlib import Path
import sys

# Archived script: live modules it imports are in waste_forecast/src/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

import numpy as np
import pandas as pd

try:
    from calendar_features import build_monthly_calendar_features
    from load_data import load_waste_data
except ImportError:  # pragma: no cover
    from src.calendar_features import build_monthly_calendar_features
    from src.load_data import load_waste_data

ROOT = Path(__file__).resolve().parents[3]  # archive/scripts -> repo root
OUTPUT_PATH = ROOT / "waste_forecast" / "evaluation" / "monthly" / "monthly_dataset.csv"


def build_monthly_dataset() -> tuple[pd.DataFrame, list[str]]:
    _, monthly = load_waste_data(ROOT)
    monthly = monthly[(monthly["date"] >= "2023-01-01") & (monthly["date"] <= "2025-09-30")].copy()
    monthly["date"] = pd.to_datetime(monthly["date"]) + pd.offsets.MonthEnd(0)
    calendar = build_monthly_calendar_features("2023-01-01", "2025-09-30")
    frame = monthly.merge(calendar, on=["year", "month"], how="left").sort_values("date").reset_index(drop=True)
    frame["month_sin"] = np.sin(2 * np.pi * frame["month"] / 12)
    frame["month_cos"] = np.cos(2 * np.pi * frame["month"] / 12)
    frame["lag_1"] = frame["waste_tons"].shift(1)
    frame["lag_12"] = frame["waste_tons"].shift(12)
    frame["rolling_mean_3"] = frame["waste_tons"].shift(1).rolling(3, min_periods=1).mean()
    feature_columns = [
        "month_sin", "month_cos", "year", "n_weekend_days", "n_holidays",
        "n_long_weekend_days", "lag_1", "lag_12", "rolling_mean_3",
    ]
    return frame, feature_columns


def main() -> None:
    frame, _ = build_monthly_dataset()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(frame)} measured monthly rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()