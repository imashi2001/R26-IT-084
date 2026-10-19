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


def _calendar_bounds(total_all: pd.DataFrame) -> tuple[str, str]:
    historical_start = pd.Timestamp("2023-01-01")
    historical_end = pd.Timestamp("2025-12-31")

    if total_all.empty:
        return historical_start.strftime("%Y-%m-%d"), historical_end.strftime("%Y-%m-%d")

    if "date" in total_all:
        dates = pd.to_datetime(total_all["date"])
    else:
        dates = pd.to_datetime(
            total_all["year"].astype(str) + "-" + total_all["month"].astype(str) + "-01"
        )

    data_start = dates.min().to_period("M").start_time
    data_end = dates.max().to_period("M").end_time.normalize()

    # Keep the original historical window as a minimum while covering all supplied months.
    start_date = min(historical_start, data_start)
    end_date = max(historical_end, data_end)
    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def build_feature_table_with_metadata(
    monthly_df: pd.DataFrame | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, list[str]]:
    if monthly_df is None:
        waste_df, total_all = load_waste_data(WORKSPACE_ROOT)
    else:
        total_all = monthly_df.copy()
        waste_df = total_all.copy()

    calendar_start, calendar_end = _calendar_bounds(total_all)
    calendar_df = build_monthly_calendar_features(
        start_date=calendar_start,
        end_date=calendar_end,
    )

    total_all = total_all.sort_values(["year", "month"]).reset_index(drop=True)
    total_all = total_all.rename(columns={"waste_tons": "waste_tons"})
    total_all["_period"] = pd.to_datetime(
        total_all[["year", "month"]].assign(day=1)
    ).dt.to_period("M")
    available_periods = set(total_all["_period"])
    continuous_periods = pd.period_range(
        start=total_all["_period"].min(),
        end=total_all["_period"].max(),
        freq="M",
    )

    # Keep absent months as NaN so positional shifts cannot skip calendar gaps.
    monthly_series = total_all.set_index("_period").reindex(continuous_periods)
    monthly_series.index.name = "_period"
    monthly_series["year"] = monthly_series.index.year
    monthly_series["month"] = monthly_series.index.month
    monthly_series["date"] = monthly_series.index.to_timestamp()
    monthly_series = monthly_series.reset_index()

    merged = monthly_series.merge(calendar_df, on=["year", "month"], how="left")
    merged = merged.sort_values(["year", "month"]).reset_index(drop=True)
    merged["lag_1"] = merged["waste_tons"].shift(1)
    merged["lag_2"] = merged["waste_tons"].shift(2)
    merged["lag_3"] = merged["waste_tons"].shift(3)
    merged["rolling_mean_3"] = merged["waste_tons"].shift(1).rolling(window=3, min_periods=3).mean()
    merged["rolling_std_3"] = merged["waste_tons"].shift(1).rolling(window=3, min_periods=3).std()

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

    merged = merged[merged["_period"].isin(available_periods)].copy()
    merged = merged.sort_values(["year", "month"]).reset_index(drop=True)
    X = merged[feature_columns].copy()
    y = merged["waste_tons"].copy()
    usable = X.dropna().index
    dropped_rows = merged.loc[~merged.index.isin(usable), ["year", "month"]]
    if not dropped_rows.empty:
        first_period = min(available_periods)
        warmup_months = []
        gap_months = []
        for row in dropped_rows.itertuples(index=False):
            period = pd.Period(year=int(row.year), month=int(row.month), freq="M")
            missing_previous = [
                period - offset
                for offset in (1, 2, 3)
                if period - offset not in available_periods
            ]
            if missing_previous and all(previous < first_period for previous in missing_previous):
                warmup_months.append(f"{int(row.year):04d}-{int(row.month):02d}")
            else:
                gap_months.append(f"{int(row.year):04d}-{int(row.month):02d}")
        if warmup_months:
            print(
                "[features][WARNING] Dropped "
                f"{len(warmup_months)} lag warm-up row(s): "
                f"{', '.join(warmup_months)}"
            )
        if gap_months:
            print(
                "[features][WARNING] Dropped "
                f"{len(gap_months)} calendar-gap row(s): "
                f"{', '.join(gap_months)}"
            )
    X = X.loc[usable].copy()
    y = y.loc[usable].copy()
    merged = merged.loc[usable].copy().reset_index(drop=True)

    print(f"Rows usable for training after feature validation: {len(X)}")
    print(f"Rows discarded from lagging or calendar gaps: {len(total_all) - len(X)}")

    return merged, X, y, feature_columns


def build_feature_table(
    monthly_df: pd.DataFrame | None = None,
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    _, X, y, feature_columns = build_feature_table_with_metadata(monthly_df)
    return X, y, feature_columns


if __name__ == "__main__":
    X, y, columns = build_feature_table()
    print(X.head())
    print("Feature columns:", columns)
    print("Target shape:", y.shape)
