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

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from calendar_features import build_daily_calendar
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES, CATEGORY_SHARES
except ImportError:
    from src.calendar_features import build_daily_calendar
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES, CATEGORY_SHARES

seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}


def convert_to_kg(value):
    """Convert model output from metric tons to kilograms (1 metric ton = 1000.0 kg)."""
    return float(value) * 1000.0


def identify_institute_id(row):
    if row.get('Institute_Dehiwala - Mt Lavinia') == 1:
        return 'dehiwala-mtlavinia'
    if row.get('Institute_Moratuwa M.C.') == 1:
        return 'moratuwa-mc'
    if row.get('Institute_Sri J,puraKotte M.C.') == 1:
        return 'kotte-mc'
    if row.get('Institute_Maharagama U.C.') == 1:
        return 'maharagama-uc'
    if row.get('Institute_Kesbewa U.C.') == 1:
        return 'kesbewa-uc'
    if row.get('Institute_Homagama P.S.') == 1:
        return 'homagama-ps'
    if row.get('Institute_Kothalawala Defence University') == 1:
        return 'kdu-campus'
    # Boralesgamuwa U.C. was not a distinct institute in training; maps to Institute_Other fallback
    return 'boralesgamuwa-uc'


def identify_category_name(row):
    if row.get('Category_Burnable') == 1:
        return 'Burnable'
    if row.get('Category_SOW') == 1:
        return 'SOW'
    if row.get('Category_Unburnable') == 1:
        return 'Unburnable'
    if row.get('Category_Sanitary Waste') == 1:
        return 'Sanitary Waste'
    if row.get('Category_Industrial Waste') == 1:
        return 'Industrial Waste'
    if row.get('Category_Slaughter House Waste') == 1:
        return 'Slaughter House Waste'
    if row.get('Category_C & D') == 1:
        return 'C & D'
    return 'Bulky Waste'


def apply_post_prediction_adjustments(prediction_tons, row):
    """Convert prediction tons to KG (x1000.0) and apply event-aware adjustments."""
    adjusted = convert_to_kg(prediction_tons)

    if row.get('Is_Weekend') == 1 or row.get('Is_Long_Weekend') == 1:
        adjusted *= 1.5

    # Match institute names (Exact 'Institute_Sri J,puraKotte M.C.', 'Institute_Moratuwa M.C.')
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

    with open(FEATURE_COLUMNS_PATH, 'r') as f:
        feature_columns = json.load(f)

    # Load real XGBoost model from waste_forecast/models/model.json
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    # Extract date/month from input rows
    month = input_data[0].get('Month', datetime.now().month) if input_data else datetime.now().month
    year = datetime.now().year
    date_str = input_data[0].get('dateStr') if (input_data and input_data[0].get('dateStr')) else f"{year}-{month:02d}-15"

    # Compute base daily waste estimate in metric tons using model & calendar disaggregation
    daily_res = estimate_daily_waste(date_str, mode="auto")
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    adjusted_predictions = []
    for idx, row in enumerate(input_data):
        inst_id = identify_institute_id(row)
        cat_name = identify_category_name(row)

        inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
        cat_share = CATEGORY_SHARES.get(cat_name, 0.045)

        # Scale item share by historical institute scale and historical category composition
        item_base_tons = base_daily_tons * inst_share * cat_share
        adjusted_val = apply_post_prediction_adjustments(item_base_tons, row)
        adjusted_predictions.append(adjusted_val)

    with open('output.json', 'w') as f:
        json.dump(adjusted_predictions, f)

except Exception as e:
    with open('output.json', 'w') as f:
        json.dump({"error": str(e)}, f)
