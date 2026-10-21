from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

def resolve_workspace_root(workspace_root: Path | None = None) -> Path:
    if workspace_root is not None:
        return Path(workspace_root)
    env_root = os.environ.get("WORKSPACE_ROOT")
    if env_root:
        return Path(env_root)
    return Path(__file__).resolve().parents[2]


def paths_for_root(root: Path) -> dict[str, Path]:
    models_dir = root / "waste_forecast" / "models"
    return {
        "root": root,
        "models_dir": models_dir,
        "live_model": models_dir / "model.json",
        "candidate_model": models_dir / "model_candidate.json",
        "feature_columns": models_dir / "feature_columns.json",
        "registry": models_dir / "model_registry.json",
        "data_file": root / "backend" / "data" / "waste_entries.json",
    }

_DEFAULT_SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(_DEFAULT_SRC))
sys.path.insert(0, str(_DEFAULT_SRC.parent))

try:
    from features import build_feature_table
    from load_data import load_waste_data
except ImportError:
    from src.features import build_feature_table
    from src.load_data import load_waste_data


def load_model_registry(workspace_root: Path | None = None) -> list[dict[str, object]]:
    paths = paths_for_root(resolve_workspace_root(workspace_root))
    registry_path = paths["registry"]
    if not registry_path.exists():
        return []
    with open(registry_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_model_registry(
    registry: list[dict[str, object]], workspace_root: Path | None = None
) -> None:
    paths = paths_for_root(resolve_workspace_root(workspace_root))
    with open(paths["registry"], "w", encoding="utf-8") as fh:
        json.dump(registry, fh, indent=2)


def evaluate_model_rmse(model_path: Path, X: pd.DataFrame, y: pd.Series) -> float:
    if not model_path.exists() or len(X) == 0:
        return 999.0
    booster = xgb.Booster()
    booster.load_model(str(model_path))
    dmatrix = xgb.DMatrix(X)
    preds = booster.predict(dmatrix)
    return float(np.sqrt(np.mean((y - preds) ** 2)))


def run_retrain_pipeline(
    force: bool = False,
    batch_size: int = 30,
    entries: list[dict[str, object]] | None = None,
    persist_processed: bool = True,
    workspace_root: Path | None = None,
) -> dict[str, object]:
    print("[retrain_pipeline] Initiating validation-gated retrain check...")

    root = resolve_workspace_root(workspace_root)
    paths = paths_for_root(root)

    if entries is None:
        entries = []
        if paths["data_file"].exists():
            with open(paths["data_file"], "r", encoding="utf-8") as fh:
                entries = json.load(fh)

    unprocessed = [e for e in entries if not e.get("processed_for_training", False)]
    if len(unprocessed) < batch_size and not force:
        msg = f"Retrain skipped: {len(unprocessed)} unprocessed entries (threshold = {batch_size})."
        print(f"[retrain_pipeline] {msg}")
        return {"status": "skipped", "reason": msg, "unprocessedCount": len(unprocessed)}

    # Build monthly features and targets
    waste_df, total_all = load_waste_data(root)

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
    candidate_model.save_model(str(paths["candidate_model"]))

    # Evaluate validation metrics
    live_rmse = evaluate_model_rmse(paths["live_model"], X, y)
    candidate_rmse = evaluate_model_rmse(paths["candidate_model"], X, y)

    # Validation Gate: Candidate promoted only if candidate_rmse <= live_rmse * 1.02
    threshold_rmse = live_rmse * 1.02
    is_promoted = candidate_rmse <= threshold_rmse

    if is_promoted:
        candidate_model.save_model(str(paths["live_model"]))
        outcome_msg = f"PROMOTED: Candidate RMSE ({candidate_rmse:.4f}) <= Live Threshold ({threshold_rmse:.4f})"
    else:
        outcome_msg = f"NOT PROMOTED: Candidate RMSE ({candidate_rmse:.4f}) worse than Live Threshold ({threshold_rmse:.4f})"

    print(f"[retrain_pipeline] {outcome_msg}")

    # Record run in registry
    registry = load_model_registry(workspace_root=root)
    version_str = f"v1.{len(registry) + 1}"
    record = {
        "status": "completed",
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
    save_model_registry(registry, workspace_root=root)

    # Mark entries as processed in local JSON only (MySQL handled by Express backend)
    if persist_processed and entries and paths["data_file"].exists():
        for e in entries:
            e["processed_for_training"] = True
        with open(paths["data_file"], "w", encoding="utf-8") as fh:
            json.dump(entries, fh, indent=2)

    return record


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    res = run_retrain_pipeline(force=force_flag)
    print(json.dumps(res, indent=2))
