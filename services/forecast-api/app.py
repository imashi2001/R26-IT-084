"""Waste forecasting micro-service (Railway).

XGBoost municipal waste forecast used by Express /api/waste-data and /api/waste-trend.
"""

from __future__ import annotations

import json
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
    from load_data import compute_seasonal_insights
    from predict_service import predict_rows
    from retrain_pipeline import load_model_registry, run_retrain_pipeline
except ImportError:
    from src.load_data import compute_seasonal_insights
    from src.predict_service import predict_rows
    from src.retrain_pipeline import load_model_registry, run_retrain_pipeline


class PredictBody(BaseModel):
    rows: list[dict[str, Any]] = Field(..., min_length=1)
    mode: str = Field(default="auto", description="auto | trend | forecast")


class RetrainBody(BaseModel):
    entries: list[dict[str, Any]] = Field(default_factory=list)
    force: bool = False


app = FastAPI(title="Waste Forecast API", version="1.1.0")

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
        "endpoints": [
            "GET /health",
            "POST /predict",
            "GET /insights",
            "GET /registry",
            "POST /retrain",
        ],
        "model_dir": str(WASTE_FORECAST_DIR / "models"),
        "workspace_root": str(WORKSPACE_ROOT),
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


@app.get("/registry")
def registry() -> dict[str, Any]:
    try:
        records = load_model_registry(workspace_root=WORKSPACE_ROOT)
        latest = records[-1] if records else None
        return {
            "currentVersion": latest["version"] if latest else "v1.0",
            "latestRun": latest,
            "registryHistory": list(reversed(records[-5:])),
            "totalRuns": len(records),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/retrain")
def retrain(body: RetrainBody) -> dict[str, Any]:
    try:
        return run_retrain_pipeline(
            force=body.force,
            entries=body.entries or None,
            persist_processed=False,
            workspace_root=WORKSPACE_ROOT,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
