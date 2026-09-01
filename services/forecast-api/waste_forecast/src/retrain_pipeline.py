from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

ROOT_DIR = Path(__file__).resolve().parents[2]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODELS_DIR = WASTE_FORECAST_DIR / "models"

LIVE_MODEL_PATH = MODELS_DIR / "model.json"
CANDIDATE_MODEL_PATH = MODELS_DIR / "model_candidate.json"
FEATURE_COLUMNS_PATH = MODELS_DIR / "feature_columns.json"
REGISTRY_PATH = MODELS_DIR / "model_registry.json"
DATA_FILE = ROOT_DIR / "backend" / "data" / "waste_entries.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from features import build_feature_table
    from load_data import load_waste_data
except ImportError:
    from src.features import build_feature_table
    from src.load_data import load_waste_data


def load_model_registry() -> list[dict[str, object]]:
    if not REGISTRY_PATH.exists():
        return []
    with open(REGISTRY_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_model_registry(registry: list[dict[str, object]]) -> None:
    with open(REGISTRY_PATH, "w", encoding="utf-8") as fh:
        json.dump(registry, fh, indent=2)


def evaluate_model_rmse(model_path: Path, X: pd.DataFrame, y: pd.Series) -> float:
    if not model_path.exists() or len(X) == 0:
        return 999.0
    model = xgb.XGBRegressor()
    model.load_model(str(model_path))
    preds = model.predict(X)
    return float(np.sqrt(np.mean((y - preds) ** 2)))


def run_retrain_pipeline(force: bool = False, batch_size: int = 30) -> dict[str, object]:
    print("[retrain_pipeline] Initiating validation-gated retrain check...")

    entries = []
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as fh:
            entries = json.load(fh)

    unprocessed = [e for e in entries if not e.get("processed_for_training", False)]
    if len(unprocessed) < batch_size and not force:
        msg = f"Retrain skipped: {len(unprocessed)} unprocessed entries (threshold = {batch_size})."
        print(f"[retrain_pipeline] {msg}")
        return {"status": "skipped", "reason": msg, "unprocessedCount": len(unprocessed)}

    # Build monthly features and targets
    waste_df, total_all = load_waste_data(ROOT_DIR)

    # Incorporate new entries into total_all if any exist
    if entries:
        new_df = pd.DataFrame(entries)
        new_df["entry_date"] = pd.to_datetime(new_df["entry_date"])
        new_df["year"] = new_df["entry_date"].dt.year
        new_df["month"] = new_df["entry_date"].dt.month
        monthly_new = new_df.groupby(["year", "month"], as_index=False)["weight_kg"].sum()
        monthly_new["waste_tons"] = monthly_new["weight_kg"] / 1000.0

        for _, row in monthly_new.iterrows():
            mask = (total_all["year"] == row["year"]) & (total_all["month"] == row["month"])
            if mask.any():
                total_all.loc[mask, "waste_tons"] += row["waste_tons"]

    X, y, feature_cols = build_feature_table()

    # Train Candidate Model (saves to model_candidate.json)
    candidate_model = xgb.XGBRegressor(n_estimators=10, max_depth=3, learning_rate=0.1)
    candidate_model.fit(X, y)
    candidate_model.save_model(str(CANDIDATE_MODEL_PATH))

    # Evaluate validation metrics
    live_rmse = evaluate_model_rmse(LIVE_MODEL_PATH, X, y)
    candidate_rmse = evaluate_model_rmse(CANDIDATE_MODEL_PATH, X, y)

    # Validation Gate: Candidate promoted only if candidate_rmse <= live_rmse * 1.02
    threshold_rmse = live_rmse * 1.02
    is_promoted = candidate_rmse <= threshold_rmse

    if is_promoted:
        candidate_model.save_model(str(LIVE_MODEL_PATH))
        outcome_msg = f"PROMOTED: Candidate RMSE ({candidate_rmse:.4f}) <= Live Threshold ({threshold_rmse:.4f})"
    else:
        outcome_msg = f"NOT PROMOTED: Candidate RMSE ({candidate_rmse:.4f}) worse than Live Threshold ({threshold_rmse:.4f})"

    print(f"[retrain_pipeline] {outcome_msg}")

    # Record run in registry
    registry = load_model_registry()
    version_str = f"v1.{len(registry) + 1}"
    record = {
        "version": version_str,
        "timestamp": datetime.now().isoformat(),
        "entriesCount": len(entries),
        "unprocessedCount": len(unprocessed),
        "liveRmse": round(live_rmse, 4),
        "candidateRmse": round(candidate_rmse, 4),
        "promoted": is_promoted,
        "outcome": outcome_msg,
    }
    registry.append(record)
    save_model_registry(registry)

    # Mark entries as processed if retrain ran
    if entries:
        for e in entries:
            e["processed_for_training"] = True
        with open(DATA_FILE, "w", encoding="utf-8") as fh:
            json.dump(entries, fh, indent=2)

    return record


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    res = run_retrain_pipeline(force=force_flag)
    print(json.dumps(res, indent=2))
