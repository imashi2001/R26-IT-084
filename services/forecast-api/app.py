"""Waste forecasting micro-service (Railway).

XGBoost municipal waste forecast used by Express /api/waste-data and /api/waste-trend.
"""

from __future__ import annotations

import os
import sys
import warnings
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore")

APP_ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = Path(os.environ.get("WORKSPACE_ROOT", APP_ROOT))

WASTE_FORECAST_DIR = WORKSPACE_ROOT / "waste_forecast"
if not WASTE_FORECAST_DIR.exists():
    WASTE_FORECAST_DIR = APP_ROOT / "waste_forecast"

sys.path.insert(0, str(WASTE_FORECAST_DIR))
sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from daily_forecast import estimate_daily_waste
    from load_data import INSTITUTE_SHARES, CATEGORY_SHARES, compute_seasonal_insights
except ImportError:
    from src.daily_forecast import estimate_daily_waste
    from src.load_data import INSTITUTE_SHARES, CATEGORY_SHARES, compute_seasonal_insights

SEASONAL_MULTIPLIERS = {
    "Moratuwa_December": 1.25,
    "Poya_Day_Unburnable": 1.20,
    "Poya_Day_SOW": 1.15,
    "Poya_Day_Burnable": 1.15,
}


def _identify_institute_id(row: dict) -> str:
    if row.get("Institute_Dehiwala - Mt Lavinia") == 1:
        return "dehiwala-mtlavinia"
    if row.get("Institute_Moratuwa M.C.") == 1:
        return "moratuwa-mc"
    if row.get("Institute_Sri J,puraKotte M.C.") == 1:
        return "kotte-mc"
    if row.get("Institute_Maharagama U.C.") == 1:
        return "maharagama-uc"
    if row.get("Institute_Kesbewa U.C.") == 1:
        return "kesbewa-uc"
    if row.get("Institute_Homagama P.S.") == 1:
        return "homagama-ps"
    if row.get("Institute_Kothalawala Defence University") == 1:
        return "kdu-campus"
    return "boralesgamuwa-uc"


def _identify_category_name(row: dict) -> str:
    if row.get("Category_Burnable") == 1:
        return "Burnable"
    if row.get("Category_SOW") == 1:
        return "SOW"
    if row.get("Category_Unburnable") == 1:
        return "Unburnable"
    if row.get("Category_Sanitary Waste") == 1:
        return "Sanitary Waste"
    if row.get("Category_Industrial Waste") == 1:
        return "Industrial Waste"
    if row.get("Category_Slaughter House Waste") == 1:
        return "Slaughter House Waste"
    if row.get("Category_C & D") == 1:
        return "C & D"
    return "Bulky Waste"


def _apply_adjustments_kg(base_kg: float, row: dict) -> float:
    val = max(0.0, float(base_kg))
    if row.get("Is_Weekend") == 1 or row.get("Is_Long_Weekend") == 1:
        val *= 1.5
    if row.get("Month") == 12 and row.get("Institute_Moratuwa M.C.") == 1:
        val *= SEASONAL_MULTIPLIERS["Moratuwa_December"]
    if row.get("Is_Poya_Day") == 1:
        if row.get("Category_Unburnable") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_Unburnable"]
        elif row.get("Category_SOW") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_SOW"]
        elif row.get("Category_Burnable") == 1:
            val *= SEASONAL_MULTIPLIERS["Poya_Day_Burnable"]
    return val


def predict_rows(rows: list[dict], *, mode: str = "auto") -> dict[str, Any]:
    if not rows:
        raise ValueError("rows must be a non-empty list")

    if mode == "trend":
        predictions: list[float] = []
        for row in rows:
            date_str = row.get("dateStr")
            if not date_str:
                month = int(row.get("Month") or 1)
                date_str = f"2025-{month:02d}-15"
            daily_res = estimate_daily_waste(date_str, mode="forecast")
            base_daily_tons = float(daily_res["estimated_daily_waste"])
            inst_id = _identify_institute_id(row)
            cat_name = _identify_category_name(row)
            inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
            cat_share = CATEGORY_SHARES.get(cat_name, 0.045)
            item_base_tons = base_daily_tons * inst_share * cat_share
            kg = _apply_adjustments_kg(item_base_tons * 1000.0, row)
            predictions.append(round(kg, 4))
        return {
            "predictions": predictions,
            "reliability": "reliable",
            "reliabilityNote": "",
        }

    first = rows[0]
    date_str = first.get("dateStr")
    if not date_str:
        month = int(first.get("Month") or 1)
        date_str = f"2025-{month:02d}-15"

    daily_res = estimate_daily_waste(date_str, mode=mode)
    base_daily_tons = float(daily_res["estimated_daily_waste"])

    predictions = []
    for row in rows:
        inst_id = _identify_institute_id(row)
        cat_name = _identify_category_name(row)
        inst_share = INSTITUTE_SHARES.get(inst_id, 0.090)
        cat_share = CATEGORY_SHARES.get(cat_name, 0.045)
        item_base_tons = base_daily_tons * inst_share * cat_share
        kg = _apply_adjustments_kg(item_base_tons * 1000.0, row)
        predictions.append(round(kg, 4))

    return {
        "predictions": predictions,
        "reliability": daily_res.get("reliability", "reliable"),
        "reliabilityNote": daily_res.get("reliability_note", ""),
    }


class PredictBody(BaseModel):
    rows: list[dict[str, Any]] = Field(..., min_length=1)
    mode: str = Field(default="auto", description="auto | trend")


app = FastAPI(title="Waste Forecast API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "waste-forecast",
        "endpoints": ["GET /health", "POST /predict", "GET /insights"],
        "model_dir": str(WASTE_FORECAST_DIR / "models"),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    model_path = WASTE_FORECAST_DIR / "models" / "model.json"
    ok = model_path.exists()
    err = None if ok else f"Missing model at {model_path}"
    return {"ok": ok, "model_path": str(model_path), "error": err}


@app.post("/predict")
def predict(body: PredictBody) -> dict[str, Any]:
    try:
        return predict_rows(body.rows, mode=body.mode)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/insights")
def insights() -> dict[str, Any]:
    try:
        return compute_seasonal_insights()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
