
import json, sys, os, pandas as pd, warnings, xgboost as xgb
from pathlib import Path
warnings.filterwarnings('ignore')

ROOT_DIR = Path(os.getcwd()).parents[0]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODEL_PATH = WASTE_FORECAST_DIR / "models" / "model.json"
FEATURE_COLUMNS_PATH = WASTE_FORECAST_DIR / "models" / "feature_columns.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES, CATEGORY_SHARES
except ImportError:
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES, CATEGORY_SHARES

with open('input_trend.json','r') as f: input_data = json.load(f)

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

seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}

adjusted = []

for idx, row in enumerate(input_data):
    month = row.get('Month', 9)
    date_str = f"2025-{month:02d}-15"
    daily_res = estimate_daily_waste(date_str, mode="forecast")
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    inst_id = identify_institute_id(row)
    cat_name = identify_category_name(row)

    inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
    cat_share = CATEGORY_SHARES.get(cat_name, 0.045)

    item_base_tons = base_daily_tons * inst_share * cat_share
    val = max(0, float(item_base_tons * 1000.0))

    if row.get('Is_Weekend') == 1 or row.get('Is_Long_Weekend') == 1:
        val *= 1.5
    if row.get('Month') == 12 and row.get('Institute_Moratuwa M.C.') == 1:
        val *= seasonal_multipliers['Moratuwa_December']
    if row.get('Is_Poya_Day') == 1:
        if row.get('Category_Unburnable') == 1:
            val *= seasonal_multipliers['Poya_Day_Unburnable']
        elif row.get('Category_SOW') == 1:
            val *= seasonal_multipliers['Poya_Day_SOW']
        elif row.get('Category_Burnable') == 1:
            val *= seasonal_multipliers['Poya_Day_Burnable']
    adjusted.append(val)

with open('output_trend.json','w') as f: json.dump(adjusted, f)
