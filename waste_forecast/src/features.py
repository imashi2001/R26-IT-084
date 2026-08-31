from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

try:
    from src.load_data import load_waste_data
    from src.calendar_features import build_monthly_calendar_features
except ImportError:  # pragma: no cover
    from load_data import load_waste_data
    from calendar_features import build_monthly_calendar_features

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]


def build_feature_table_with_metadata() -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, list[str]]:
    waste_df, total_all = load_waste_data(WORKSPACE_ROOT)
    calendar_df = build_monthly_calendar_features(start_date="2023-01-01", end_date="2025-12-31")

    total_all = total_all.sort_values(["year", "month"]).reset_index(drop=True)
    total_all = total_all.rename(columns={"waste_tons": "waste_tons"})

    merged = total_all.merge(calendar_df, on=["year", "month"], how="left")
    merged["date"] = pd.to_datetime(merged["date"])

    merged = merged.sort_values(["year", "month"]).reset_index(drop=True)
    merged["lag_1"] = merged["waste_tons"].shift(1)
    merged["lag_2"] = merged["waste_tons"].shift(2)
    merged["lag_3"] = merged["waste_tons"].shift(3)
    merged["rolling_mean_3"] = merged["waste_tons"].shift(1).rolling(window=3, min_periods=1).mean()
    merged["rolling_std_3"] = merged["waste_tons"].shift(1).rolling(window=3, min_periods=1).std().fillna(0)

    merged["month_sin"] = np.sin(2 * np.pi * merged["month"] / 12)
    merged["month_cos"] = np.cos(2 * np.pi * merged["month"] / 12)
    merged["quarter"] = ((merged["month"] - 1) // 3) + 1

    feature_columns = [
        "lag_1", "lag_2", "lag_3",
        "rolling_mean_3", "rolling_std_3",
        "n_weekend_days", "n_holidays", "n_off_days",
        "n_long_weekend_days", "n_long_weekend_events", "max_long_weekend_length",
        "n_poya_days", "n_bridge_days", "working_days",
        "month_sin", "month_cos", "quarter",
    ]

    X = merged[feature_columns].copy()
    y = merged["waste_tons"].copy()
    usable = X.dropna().index
    X = X.loc[usable].copy()
    y = y.loc[usable].copy()
    merged = merged.loc[usable].copy().reset_index(drop=True)

    print(f"Rows usable for training after lag warm-up: {len(X)}")
    print(f"Rows discarded from lagging: {len(total_all) - len(X)}")

    return merged, X, y, feature_columns


def build_feature_table() -> tuple[pd.DataFrame, pd.Series, list[str]]:
    _, X, y, feature_columns = build_feature_table_with_metadata()
    return X, y, feature_columns


if __name__ == "__main__":
    X, y, columns = build_feature_table()
    print(X.head())
    print("Feature columns:", columns)
    print("Target shape:", y.shape)
