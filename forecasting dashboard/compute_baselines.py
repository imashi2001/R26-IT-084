"""Compute historical baseline statistics for each location using the trained XGBoost model.

This script generates model predictions for every day from 2023-01-01 to 2025-12-31
for each location, sums per-category predictions into daily totals, and computes
Q1, Median, Q3, P90 percentiles per location.

Output: historical_baselines.json
"""
import pickle
import json
import warnings
from datetime import datetime, timedelta

import pandas as pd
import numpy as np

warnings.filterwarnings('ignore')

with open('trained_model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('model_features.pkl', 'rb') as f:
    features = pickle.load(f)
with open('holiday_cache.json', 'r') as f:
    holiday_cache = json.load(f)

LOCATIONS = [
    {'id': 'moratuwa-mc', 'name': 'Moratuwa M.C.', 'feature': 'Institute_Moratuwa M.C.'},
    {'id': 'boralesgamuwa-uc', 'name': 'Boralesgamuwa U.C.', 'feature': 'Institute_Other'},
    {'id': 'kesbewa-uc', 'name': 'Kesbewa U.C.', 'feature': 'Institute_Kesbewa U.C.'},
    {'id': 'dehiwala-mtlavinia', 'name': 'Dehiwala - Mt Lavinia', 'feature': 'Institute_Dehiwala - Mt Lavinia'},
    {'id': 'kotte-mc', 'name': 'Sri J,puraKotte M.C.', 'feature': 'Institute_Sri J,puraKotte M.C.'},
    {'id': 'maharagama-uc', 'name': 'Maharagama U.C.', 'feature': 'Institute_Maharagama U.C.'},
    {'id': 'homagama-ps', 'name': 'Homagama P.S.', 'feature': 'Institute_Homagama P.S.'},
    {'id': 'kdu-campus', 'name': 'Kothalawala Defence University', 'feature': 'Institute_Kothalawala Defence University'},
]

CATEGORY_FEATURES = [
    'Category_Unburnable', 'Category_SOW', 'Category_Burnable',
    'Category_C & D', 'Category_Industrial Waste',
    'Category_Slaughter House Waste', 'Category_Sanitary Waste'
]
# 'Bulky Waste' = no category feature set (baseline)

NUM_CATEGORIES = len(CATEGORY_FEATURES) + 1  # +1 for Bulky Waste


def get_holidays_for_date(date_str):
    year = date_str[:4]
    holidays = holiday_cache.get(year, [])
    return [h for h in holidays if str(h.get('iso_date', '')).startswith(date_str)]


def is_poya(date_str):
    return any(
        'poya' in h.get('name', '').lower() or 'full moon' in h.get('name', '').lower()
        for h in get_holidays_for_date(date_str)
    )


def main():
    start = datetime(2023, 1, 1)
    end = datetime(2025, 12, 31)
    total_days = (end - start).days + 1
    print("Computing baselines for {} days x {} locations...".format(total_days, len(LOCATIONS)))

    # Pre-allocate: one array per location
    baseline_data = {loc['id']: [] for loc in LOCATIONS}

    current = start
    day_count = 0
    while current <= end:
        ds = current.strftime('%Y-%m-%d')
        month = current.month
        dow = current.weekday()
        is_wkend = 1 if dow in (5, 6) else 0
        holidays = get_holidays_for_date(ds)
        is_hol = 1 if holidays else 0
        is_poya_day = 1 if is_poya(ds) else 0

        # Build all rows for all locations at once for this day (batch predict)
        all_rows = []
        for loc in LOCATIONS:
            for cat_feat in CATEGORY_FEATURES:
                r = {feat: 0 for feat in features}
                r['Is_Weekend'] = is_wkend
                r['Is_Holiday'] = is_hol
                r['Is_Long_Weekend'] = 0
                r['Month'] = month
                r['Rainfall_mm'] = 5.0
                r['Max_Temp_C'] = 30.0
                r['Waste_Lag_1'] = 15.0
                r['Waste_Lag_7'] = 15.0
                r[loc['feature']] = 1
                r[cat_feat] = 1
                all_rows.append(r)
            # Bulky Waste (no category feature)
            r = {feat: 0 for feat in features}
            r['Is_Weekend'] = is_wkend
            r['Is_Holiday'] = is_hol
            r['Is_Long_Weekend'] = 0
            r['Month'] = month
            r['Rainfall_mm'] = 5.0
            r['Max_Temp_C'] = 30.0
            r['Waste_Lag_1'] = 15.0
            r['Waste_Lag_7'] = 15.0
            r[loc['feature']] = 1
            all_rows.append(r)

        df = pd.DataFrame(all_rows)
        for col in features:
            if col not in df.columns:
                df[col] = 0
        df = df[features]
        preds = model.predict(df)

        # Parse predictions back into per-location daily totals
        idx = 0
        for loc in LOCATIONS:
            loc_preds = preds[idx:idx + NUM_CATEGORIES]
            total_kg = float(np.sum(np.maximum(loc_preds, 0)))
            baseline_data[loc['id']].append(total_kg)
            idx += NUM_CATEGORIES

        day_count += 1
        if day_count % 100 == 0:
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
        print("{:40s} | N={:4d} | Q1={:7.1f} | Med={:7.1f} | Q3={:7.1f} | P90={:7.1f} | Min={:7.1f} | Max={:7.1f}".format(
            loc['name'], len(values), q1, median_val, q3, p90, values.min(), values.max()
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

    with open('historical_baselines.json', 'w') as f:
        json.dump(baselines, f, indent=2)
    print("\nBaselines saved to historical_baselines.json")


if __name__ == '__main__':
    main()
