import json
import pickle
import warnings
from datetime import datetime, timedelta

import pandas as pd

warnings.filterwarnings('ignore')

seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}


def load_holiday_cache():
    try:
        with open('holiday_cache.json', 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def shift_date(date_str, days):
    dt = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=days)
    return dt.strftime('%Y-%m-%d')


def get_holidays_for_date(date_str, cache=None):
    cache = cache or load_holiday_cache()
    year = date_str[:4]
    holidays = cache.get(year, [])
    return [h for h in holidays if str(h.get('iso_date', '')).startswith(date_str)]


def is_weekend(date_str):
    return datetime.strptime(date_str, '%Y-%m-%d').weekday() in (5, 6)


def is_public_holiday(date_str, cache=None):
    return bool(get_holidays_for_date(date_str, cache))


def calculateLongWeekend(date_str, cache=None):
    """Mirror the JavaScript rule set used by the API: 3/4/5-day long weekends."""
    cache = cache or load_holiday_cache()
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    dow = dt.weekday()
    is_non_working = lambda candidate: is_weekend(candidate) or is_public_holiday(candidate, cache)

    if dow == 5 and is_non_working(shift_date(date_str, 1)) and is_non_working(shift_date(date_str, 2)):
        return {'isLongWeekend': True, 'longWeekendDays': 3}
    if dow == 1 and is_non_working(shift_date(date_str, -1)) and is_non_working(shift_date(date_str, -2)):
        return {'isLongWeekend': True, 'longWeekendDays': 3}
    if dow == 4 and (is_weekend(shift_date(date_str, 1)) or is_public_holiday(shift_date(date_str, 1), cache)):
        return {'isLongWeekend': True, 'longWeekendDays': 4}
    if dow == 1 and (is_weekend(shift_date(date_str, -1)) or is_public_holiday(shift_date(date_str, -1), cache)):
        return {'isLongWeekend': True, 'longWeekendDays': 4}

    for start_offset in range(-2, 3):
        window = [shift_date(date_str, start_offset + index) for index in range(5)]
        has_holiday = any(is_public_holiday(day, cache) for day in window)
        all_non_working = all(is_non_working(day) for day in window)
        if has_holiday and all_non_working:
            return {'isLongWeekend': True, 'longWeekendDays': 5}

    return {'isLongWeekend': False, 'longWeekendDays': 0}


def convert_to_kg(value):
    """Normalize model output to kilograms. Keep this as 1.0 for kg-based models, or set to 1000.0 if the trained model emits tons."""
    return float(value) * 1.0


def apply_post_prediction_adjustments(prediction, row):
    """Apply event-aware adjustments after the model prediction as requested."""
    adjusted = convert_to_kg(prediction)

    if row.get('Is_Weekend') == 1 or row.get('Is_Long_Weekend') == 1:
        adjusted *= 1.5

    if row.get('Month') == 12 and row.get('Institute_Moratuwa M.C.') == 1:
        adjusted *= seasonal_multipliers['Moratuwa_December']

    if row.get('Is_Poya_Day') == 1:
        if row.get('Category_Unburnable') == 1:
            adjusted *= seasonal_multipliers['Poya_Day_Unburnable']
        elif row.get('Category_SOW') == 1:
            adjusted *= seasonal_multipliers['Poya_Day_SOW']
        elif row.get('Category_Burnable') == 1:
            adjusted *= seasonal_multipliers['Poya_Day_Burnable']

    return adjusted


try:
    with open('input.json', 'r') as f:
        input_data = json.load(f)

    with open('trained_model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('model_features.pkl', 'rb') as f:
        features = pickle.load(f)

    df = pd.DataFrame(input_data)

    for col in features:
        if col not in df.columns:
            df[col] = 0

    df = df[features]
    predictions = model.predict(df).tolist()

    adjusted_predictions = []
    for idx, prediction in enumerate(predictions):
        row = input_data[idx] if idx < len(input_data) else {}
        adjusted_predictions.append(apply_post_prediction_adjustments(prediction, row))

    with open('output.json', 'w') as f:
        json.dump(adjusted_predictions, f)

except Exception as e:
    with open('output.json', 'w') as f:
        json.dump({"error": str(e)}, f)
