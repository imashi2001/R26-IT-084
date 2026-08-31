import json
import sys
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import xgboost as xgb

warnings.filterwarnings('ignore')

# Resolve paths to waste_forecast modules and model files
ROOT_DIR = Path(__file__).resolve().parents[1]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODEL_PATH = WASTE_FORECAST_DIR / "models" / "model.json"
FEATURE_COLUMNS_PATH = WASTE_FORECAST_DIR / "models" / "feature_columns.json"
HOLIDAY_CACHE_PATH = ROOT_DIR / "forecasting dashboard" / "holiday_cache.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from calendar_features import build_daily_calendar
    from daily_forecast import estimate_daily_waste
except ImportError:
    from src.calendar_features import build_daily_calendar
    from src.daily_forecast import estimate_daily_waste

seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}


def convert_to_kg(value):
    """Convert model output from metric tons to kilograms (1 metric ton = 1000.0 kg)."""
    return float(value) * 1000.0


def apply_post_prediction_adjustments(prediction, row):
    """Apply event-aware adjustments after model prediction."""
    adjusted = convert_to_kg(prediction)

    if row.get('Is_Weekend') == 1 or row.get('Is_Long_Weekend') == 1:
        adjusted *= 1.5

    # Match institute names (Exact 'Institute_Sri J,puraKotte M.C.', 'Institute_Moratuwa M.C.')
    # Boralesgamuwa U.C. uses 'Institute_Other' fallback
    if row.get('Month') == 12 and (row.get('Institute_Moratuwa M.C.') == 1 or row.get('Institute_Moratuwa') == 1):
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

    with open(FEATURE_COLUMNS_PATH, 'r') as f:
        feature_columns = json.load(f)

    # Load real XGBoost model from waste_forecast/models/model.json
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    # Extract date/month from input rows
    month = input_data[0].get('Month', datetime.now().month) if input_data else datetime.now().month
    year = datetime.now().year
    date_str = f"{year}-{month:02d}-15"

    # Compute base daily waste estimate in metric tons using model & calendar disaggregation
    daily_res = estimate_daily_waste(date_str, mode="forecast")
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    num_rows = len(input_data)
    per_item_base_tons = base_daily_tons / float(num_rows) if num_rows > 0 else base_daily_tons / 64.0

    adjusted_predictions = []
    for idx, row in enumerate(input_data):
        # Boralesgamuwa U.C. maps to Institute_Other fallback
        adjusted_val = apply_post_prediction_adjustments(per_item_base_tons, row)
        adjusted_predictions.append(adjusted_val)

    with open('output.json', 'w') as f:
        json.dump(adjusted_predictions, f)

except Exception as e:
    with open('output.json', 'w') as f:
        json.dump({"error": str(e)}, f)
