
import json, pickle, pandas as pd, warnings
warnings.filterwarnings('ignore')
with open('input_trend.json','r') as f: input_data = json.load(f)
with open('trained_model.pkl','rb') as f: model = pickle.load(f)
with open('model_features.pkl','rb') as f: features = pickle.load(f)
df = pd.DataFrame(input_data)
for col in features:
    if col not in df.columns:
        df[col] = 0
df = df[features]
preds = model.predict(df).tolist()
# Apply same post-prediction adjustments as run_model.py
seasonal_multipliers = {
    'Moratuwa_December': 1.25,
    'Poya_Day_Unburnable': 1.20,
    'Poya_Day_SOW': 1.15,
    'Poya_Day_Burnable': 1.15,
}
adjusted = []
for idx, p in enumerate(preds):
    val = max(0, float(p))
    row = input_data[idx] if idx < len(input_data) else {}
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
