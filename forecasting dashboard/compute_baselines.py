"""Compute baseline statistics for each location over a trailing window before a forecast date.

Usage: python compute_baselines.py [YYYY-MM-DD]   (default: today in Asia/Colombo)
Output: backend/historical_baselines.json
"""
import json
import sys
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

warnings.filterwarnings('ignore')

ROOT_DIR = Path(__file__).resolve().parents[1]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
OUTPUT_BASELINES_PATH = ROOT_DIR / "backend" / "historical_baselines.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES
except ImportError:
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES

LOCATIONS = [
    {'id': 'moratuwa-mc', 'name': 'Moratuwa M.C.'},
    {'id': 'boralesgamuwa-uc', 'name': 'Boralesgamuwa U.C.'},
    {'id': 'kesbewa-uc', 'name': 'Kesbewa U.C.'},
    {'id': 'dehiwala-mtlavinia', 'name': 'Dehiwala - Mt Lavinia'},
    {'id': 'kotte-mc', 'name': 'Sri J,puraKotte M.C.'},
    {'id': 'maharagama-uc', 'name': 'Maharagama U.C.'},
    {'id': 'homagama-ps', 'name': 'Homagama P.S.'},
    {'id': 'kdu-campus', 'name': 'Kothalawala Defence University'},
]


# Baseline window length, trailing back from the forecast date.
# The series grows 6-15% per year, so percentiles over a fixed 2023-2025 block put
# every 2026 day above P90 by construction. A trailing window keeps the bands on
# the current level of the series. 12 months is the shortest span that still
# covers every calendar month once (so seasonality and every day type are in the
# sample) while lagging the trend by only ~6 months (half the window).
# Days in the window that have no actuals use the same trend-model estimate the
# forecast uses, so the file must be regenerated as the forecast date moves.
BASELINE_WINDOW_MONTHS = 12


def main(forecast_date=None):
    if forecast_date is None:
        forecast_date = pd.Timestamp.now(tz="Asia/Colombo").strftime("%Y-%m-%d")
    forecast_ts = pd.Timestamp(forecast_date).normalize()
    end = (forecast_ts - pd.Timedelta(days=1)).to_pydatetime()
    start = (forecast_ts - pd.DateOffset(months=BASELINE_WINDOW_MONTHS)).to_pydatetime()
    print("Trailing {}-month baseline window for forecast date {}: {} to {}".format(
        BASELINE_WINDOW_MONTHS, forecast_ts.date(), start.date(), end.date()))
    total_days = (end - start).days + 1
    print("Computing real baselines for {} days x {} locations...".format(total_days, len(LOCATIONS)))

    baseline_data = {loc['id']: [] for loc in LOCATIONS}

    current = start
    day_count = 0
    while current <= end:
        ds = current.strftime('%Y-%m-%d')
        daily_res = estimate_daily_waste(ds, mode="forecast")
        total_daily_tons = float(daily_res["estimated_daily_waste"])

        # Convert total tons to KG (x 1000) and scale per institute by historical scale share
        total_daily_kg = total_daily_tons * 1000.0

        for loc in LOCATIONS:
            inst_share = INSTITUTE_SHARES.get(loc['id'], 0.090)
            per_location_kg = total_daily_kg * inst_share
            baseline_data[loc['id']].append(per_location_kg)

        day_count += 1
        if day_count % 300 == 0:
            print("  Processed {}/{} days...".format(day_count, total_days))

        current += timedelta(days=1)

    print("Computing percentiles...")
    baselines = {}
    for loc in LOCATIONS:
        values = np.array(baseline_data[loc['id']])
        q1 = float(np.percentile(values, 25))
        median_val = float(np.percentile(values, 50))
        q3 = float(np.percentile(values, 75))
        p90 = float(np.percentile(values, 90))
        print("{:40s} | N={:4d} | Q1={:7.1f} | Med={:7.1f} | Q3={:7.1f} | P90={:7.1f}".format(
            loc['name'], len(values), q1, median_val, q3, p90
        ))
        baselines[loc['id']] = {
            'locationId': loc['id'],
            'locationName': loc['name'],
            'q1Kg': round(q1, 1),
            'medianKg': round(median_val, 1),
            'q3Kg': round(q3, 1),
            'p90Kg': round(p90, 1),
            'sampleSize': len(values),
            'periodStart': start.strftime('%Y-%m-%d'),
            'periodEnd': end.strftime('%Y-%m-%d'),
            'forecastDate': forecast_ts.strftime('%Y-%m-%d'),
            'windowMonths': BASELINE_WINDOW_MONTHS,
            'method': 'location_specific_daily_weight_percentiles_trailing_window'
        }

    with open(OUTPUT_BASELINES_PATH, 'w') as f:
        json.dump(baselines, f, indent=2)
    print("\nBaselines saved to", OUTPUT_BASELINES_PATH)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
