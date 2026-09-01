import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

ROOT_DIR = Path(__file__).resolve().parents[1]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from predict_service import predict_rows
except ImportError:
    from src.predict_service import predict_rows


try:
    with open("input.json", "r", encoding="utf-8") as f:
        input_data = json.load(f)

    output_payload = predict_rows(input_data, mode="auto")

    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(output_payload, f)

except Exception as e:
    with open("output.json", "w", encoding="utf-8") as f:
        json.dump({"error": str(e)}, f)
