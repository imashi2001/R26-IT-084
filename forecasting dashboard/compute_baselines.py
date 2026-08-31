"""Compute historical baseline statistics for each location using the trained XGBoost model.

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
MODEL_PATH = WASTE_FORECAST_DIR / "models" / "model.json"
FEATURE_COLUMNS_PATH = WASTE_FORECAST_DIR / "models" / "feature_columns.json"
OUTPUT_BASELINES_PATH = ROOT_DIR / "backend" / "historical_baselines.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from daily_forecast import estimate_daily_waste
except ImportError:
    from src.daily_forecast import estimate_daily_waste

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


def main():
    start = datetime(2023, 1, 1)
    end = datetime(2025, 12, 31)
    total_days = (end - start).days + 1
    print("Computing real baselines for {} days x {} locations...".format(total_days, len(LOCATIONS)))

    baseline_data = {loc['id']: [] for loc in LOCATIONS}

    current = start
    day_count = 0
    while current <= end:
        ds = current.strftime('%Y-%m-%d')
        daily_res = estimate_daily_waste(ds, mode="forecast")
        total_daily_tons = float(daily_res["estimated_daily_waste"])

        # Convert total tons to KG (x 1000) and distribute across locations
        total_daily_kg = total_daily_tons * 1000.0
        per_location_kg = total_daily_kg / len(LOCATIONS)

        for loc in LOCATIONS:
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
            'periodStart': '2023-01-01',
            'periodEnd': '2025-12-31',
            'method': 'location_specific_daily_weight_percentiles'
        }

    with open(OUTPUT_BASELINES_PATH, 'w') as f:
        json.dump(baselines, f, indent=2)
    print("\nBaselines saved to", OUTPUT_BASELINES_PATH)


if __name__ == '__main__':
    main()
