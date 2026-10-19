"""Smoke-test the merged CRUD month and calendar-aware feature lags."""

from pathlib import Path

import pandas as pd

from features import build_feature_table_with_metadata
from load_data import load_waste_data


ROOT_DIR = Path(__file__).resolve().parents[2]


def main() -> None:
    _, historical_months = load_waste_data(ROOT_DIR)
    synthetic_days = pd.date_range("2026-01-01", periods=20, freq="D")
    synthetic_month = pd.DataFrame(
        {
            "year": synthetic_days.year,
            "month": synthetic_days.month,
            "weight_kg": 100.0,
            "entry_date": synthetic_days,
        }
    )
    synthetic_monthly = (
        synthetic_month.groupby(["year", "month"], as_index=False)["weight_kg"]
        .sum()
        .assign(waste_tons=lambda frame: frame["weight_kg"] / 1000.0)
    )
    synthetic_monthly["date"] = pd.to_datetime(
        synthetic_monthly[["year", "month"]].assign(day=1)
    )
    merged_input = pd.concat(
        [historical_months, synthetic_monthly[historical_months.columns]],
        ignore_index=True,
    ).sort_values(["year", "month"])

    metadata, _, _, _ = build_feature_table_with_metadata(merged_input)
    target = metadata[(metadata["year"] == 2026) & (metadata["month"] == 1)]
    assert len(target) == 1, "The complete synthetic month was not retained."
    assert target["lag_1"].iloc[0] == 34.5, "lag_1 is not 2025-12."
    assert target["lag_2"].iloc[0] == 29.0, "lag_2 is not 2025-11."
    assert target["lag_3"].iloc[0] == 29.7, "lag_3 is not 2025-10."
    print("PASS: 2026-01 is retained with calendar-aware lags 34.5, 29.0, 29.7.")


if __name__ == "__main__":
    main()
