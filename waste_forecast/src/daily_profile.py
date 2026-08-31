from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from src.calendar_features import build_daily_calendar
except ImportError:  # pragma: no cover
    from calendar_features import build_daily_calendar

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = PROJECT_ROOT / "models" / "daily_profile.json"

# These weights are explicit assumptions, not learned from daily raw data.
# If real daily waste records become available, replace this with observed day-type ratios.
DAY_TYPE_WEIGHTS = {
    "weekday": 1.0,
    "weekend": 0.75,
    "holiday": 0.55,
    "long_weekend": 0.30,
    "bridge_day": 0.80,
}


def classify_day_type(day_row: pd.Series) -> str:
    if bool(day_row.get("is_long_weekend_bridge", False)):
        return "bridge_day"
    if bool(day_row.get("is_long_weekend", False)):
        return "long_weekend"
    if bool(day_row.get("is_holiday", False)):
        return "holiday"
    if bool(day_row.get("is_weekend", False)):
        return "weekend"
    return "weekday"


def build_daily_share_profile(start_date: str = "2023-01-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    daily = build_daily_calendar(start_date=start_date, end_date=end_date).copy()
    daily["day_type"] = daily.apply(classify_day_type, axis=1)
    daily["day_weight"] = daily["day_type"].map(DAY_TYPE_WEIGHTS)

    profiles: list[dict[str, object]] = []
    grouped = daily.groupby(["year", "month"], group_keys=False)

    for _, month_df in grouped:
        month_df = month_df.sort_values("date").reset_index(drop=True)
        month_weight_total = month_df["day_weight"].sum()
        if month_weight_total <= 0:
            raise ValueError(f"Month {month_df['year'].iloc[0]}-{month_df['month'].iloc[0]} had zero total day weight.")

        month_df["daily_share"] = month_df["day_weight"] / month_weight_total
        month_df["daily_share_pct"] = month_df["daily_share"] * 100.0

        # This must sum to exactly 1.0 within a month; otherwise the daily estimates would not reconcile to the monthly total.
        assert np.isclose(month_df["daily_share"].sum(), 1.0, atol=1e-9), (
            "Daily shares must sum to 1.0 within each month for exact monthly reconciliation."
        )

        for _, row in month_df.iterrows():
            profiles.append({
                "date": pd.Timestamp(row["date"]).date().isoformat(),
                "year": int(row["year"]),
                "month": int(row["month"]),
                "day_type": row["day_type"],
                "day_weight": float(row["day_weight"]),
                "daily_share": float(row["daily_share"]),
                "daily_share_pct": float(row["daily_share_pct"]),
            })

    result = pd.DataFrame(profiles)
    return result.sort_values(["year", "month", "date"]).reset_index(drop=True)


def save_profile_json(profile_df: pd.DataFrame, output_path: str | Path = PROFILE_PATH) -> dict[str, object]:
    out_path = Path(output_path)
    out_path.parent.mkdir(exist_ok=True, parents=True)

    months = {}
    for month_key, month_frame in profile_df.groupby(["year", "month"]):
        months[f"{month_key[0]}-{month_key[1]:02d}"] = month_frame[[
            "date", "day_type", "day_weight", "daily_share", "daily_share_pct"
        ]].to_dict(orient="records")

    payload = {
        "note": "Daily estimate derived from monthly totals disaggregated by assumed day-type weights; not a true daily-trained model.",
        "assumption_note": "These day-type weights are assumptions, not learned from data. If/when daily raw waste records become available, replace this with actual observed daily/weekend/holiday ratios computed directly from that data.",
        "weights": DAY_TYPE_WEIGHTS,
        "sample_months": {
            "2023-01": months.get("2023-01", [])[:5],
            "2024-04": months.get("2024-04", [])[:5],
        },
        "months": months,
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)

    return payload


def main() -> None:
    profile_df = build_daily_share_profile()
    payload = save_profile_json(profile_df)
    print("Saved daily profile to:", PROFILE_PATH)
    print("Sample month profile (2023-01):")
    for entry in payload["sample_months"]["2023-01"]:
        print(entry)
    print("\nSample month profile (2024-04):")
    for entry in payload["sample_months"]["2024-04"]:
        print(entry)


if __name__ == "__main__":
    main()
