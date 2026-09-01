from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

def get_holiday_cache_path() -> Path:
    file_dir = Path(__file__).resolve().parent
    workspace = file_dir.parents[2] if len(file_dir.parents) > 2 else Path.cwd()
    for candidate in [
        workspace / "forecasting dashboard" / "holiday_cache.json",
        workspace / "backend" / "holiday_cache.json",
        file_dir.parents[1] / "data" / "holiday_cache.json",
        file_dir.parents[1] / "forecasting dashboard" / "holiday_cache.json",
        file_dir.parents[2] / "forecasting dashboard" / "holiday_cache.json",
        Path.cwd() / "holiday_cache.json",
        Path.cwd() / "forecasting dashboard" / "holiday_cache.json",
    ]:
        if candidate.exists():
            return candidate
    return workspace / "forecasting dashboard" / "holiday_cache.json"

HOLIDAY_CACHE_PATH = get_holiday_cache_path()
QUALIFYING_HOLIDAY_TYPES = {"National holiday"}


def load_holiday_cache(cache_path: str | Path = None) -> pd.DataFrame:
    cache_path = cache_path or get_holiday_cache_path()
    with open(cache_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    if not isinstance(payload, dict):
        raise ValueError(f"Expected holiday cache JSON to be a dict keyed by year, got {type(payload).__name__}.")

    rows: list[dict[str, object]] = []
    for year_key, entries in payload.items():
        if not isinstance(entries, list):
            continue
        for item in entries:
            if not isinstance(item, dict):
                continue
            iso_date = item.get("iso_date")
            if not iso_date:
                continue
            dt = pd.to_datetime(str(iso_date)[:10]).normalize()
            rows.append({
                "year": int(year_key),
                "date": dt,
                "name": item.get("name", ""),
                "primary_type": item.get("primary_type", ""),
            })

    return pd.DataFrame(rows).sort_values("date").reset_index(drop=True)


def detect_long_weekend_runs(calendar: pd.DataFrame) -> pd.DataFrame:
    calendar = calendar.copy().sort_values("date").reset_index(drop=True)
    calendar["off_day_run_id"] = (
        calendar["is_off_day"].ne(calendar["is_off_day"].shift(fill_value=False)).cumsum()
    )
    calendar["long_weekend_length"] = 0
    calendar["is_long_weekend"] = False
    calendar["is_long_weekend_bridge"] = False

    off_runs = calendar[calendar["is_off_day"]].groupby("off_day_run_id")
    for run_id, run_df in off_runs:
        run_length = len(run_df)
        if run_length >= 3:
            calendar.loc[run_df.index, "is_long_weekend"] = True
            calendar.loc[run_df.index, "long_weekend_length"] = run_length

    # Guard against a broken bridge rule: if a workday sits between two off-day runs and the total span is 5 days,
    # mark the full five-day segment as a bridge event.
    for idx in range(1, len(calendar) - 1):
        if calendar.iloc[idx]["is_off_day"]:
            continue
        left = calendar.iloc[idx - 1]
        right = calendar.iloc[idx + 1]
        if not left["is_off_day"] or not right["is_off_day"]:
            continue
        left_run = int(left["long_weekend_length"]) if left["is_long_weekend"] else 0
        right_run = int(right["long_weekend_length"]) if right["is_long_weekend"] else 0
        if left_run == 0 or right_run == 0:
            continue
        total_span = left_run + 1 + right_run
        if total_span == 5:
            span_start = min(left["date"], right["date"]) - pd.Timedelta(days=left_run - 1)
            span_end = max(left["date"], right["date"]) + pd.Timedelta(days=right_run - 1)
            mask = (calendar["date"] >= span_start) & (calendar["date"] <= span_end)
            calendar.loc[mask, "is_long_weekend_bridge"] = True

    if not calendar.empty and (pd.Timestamp("2024-04-12") in calendar["date"].values) and (pd.Timestamp("2024-04-15") in calendar["date"].values):
        new_year_window = calendar[(calendar["date"] >= "2024-04-12") & (calendar["date"] <= "2024-04-15")]
        if len(new_year_window) == 4:
            assert new_year_window["is_off_day"].all(), "The New Year period should be treated as off-days."
            assert new_year_window["is_long_weekend"].all(), "The New Year period should count as a long weekend."

    return calendar


def build_daily_calendar(start_date: str = "2023-01-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    holiday_df = load_holiday_cache(HOLIDAY_CACHE_PATH)
    calendar = pd.DataFrame({"date": pd.date_range(start=start_date, end=end_date, freq="D")})
    calendar["year"] = calendar["date"].dt.year
    calendar["month"] = calendar["date"].dt.month
    calendar["day_of_week"] = calendar["date"].dt.dayofweek
    calendar["is_weekend"] = calendar["day_of_week"] >= 5

    holiday_df = holiday_df[holiday_df["primary_type"].isin(QUALIFYING_HOLIDAY_TYPES)].copy()
    holiday_df["date"] = pd.to_datetime(holiday_df["date"]).dt.normalize()
    holiday_lookup = holiday_df[["date", "name", "primary_type"]].drop_duplicates(subset=["date"]).set_index("date")

    calendar["holiday_name"] = ""
    calendar["holiday_type"] = ""
    calendar["is_holiday"] = False
    for dt, row in holiday_lookup.iterrows():
        mask = calendar["date"] == pd.Timestamp(dt)
        calendar.loc[mask, "holiday_name"] = row["name"]
        calendar.loc[mask, "holiday_type"] = row["primary_type"]
        calendar.loc[mask, "is_holiday"] = True

    calendar["is_off_day"] = calendar["is_weekend"] | calendar["is_holiday"]
    calendar = detect_long_weekend_runs(calendar)
    calendar["n_long_weekend_days"] = calendar["is_long_weekend"].astype(int)
    calendar["n_bridge_days"] = calendar["is_long_weekend_bridge"].astype(int)
    return calendar


def build_monthly_calendar_features(start_date: str = "2023-01-01", end_date: str = "2025-12-31") -> pd.DataFrame:
    daily = build_daily_calendar(start_date=start_date, end_date=end_date)

    monthly = daily.groupby(["year", "month"], as_index=False).agg(
        n_weekend_days=("is_weekend", "sum"),
        n_holidays=("is_holiday", "sum"),
        n_off_days=("is_off_day", "sum"),
        n_long_weekend_days=("n_long_weekend_days", "sum"),
        n_long_weekend_events=("is_long_weekend", "sum"),
        max_long_weekend_length=("long_weekend_length", "max"),
        n_poya_days=("holiday_name", lambda s: int(s.str.contains("Poya", case=False, na=False).sum())),
        n_bridge_days=("n_bridge_days", "sum"),
        working_days=("is_off_day", lambda s: int((~s).sum())),
    )

    monthly["n_long_weekend_events"] = monthly["n_long_weekend_events"].fillna(0).astype(int)
    monthly["max_long_weekend_length"] = monthly["max_long_weekend_length"].fillna(0).astype(int)
    return monthly.sort_values(["year", "month"]).reset_index(drop=True)


if __name__ == "__main__":
    features = build_monthly_calendar_features()
    print(features.head())
    print(f"Rows: {len(features)}")
