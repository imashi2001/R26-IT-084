from __future__ import annotations

import json
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODELS_DIR = WASTE_FORECAST_DIR / "models"

LIVE_MODEL_PATH = MODELS_DIR / "trend_model.json"
ARCHIVE_DIR = WASTE_FORECAST_DIR / "archive"
REGISTRY_PATH = MODELS_DIR / "model_registry.json"
DATA_FILE = ROOT_DIR / "backend" / "data" / "waste_entries.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

try:
    from load_data import INSTITUTE_SHARES, load_waste_data
    from trend_model import WeightedTrendModel
except ImportError:
    from src.load_data import INSTITUTE_SHARES, load_waste_data
    from src.trend_model import WeightedTrendModel


def load_model_registry() -> list[dict[str, object]]:
    if not REGISTRY_PATH.exists():
        return []
    with open(REGISTRY_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_model_registry(registry: list[dict[str, object]]) -> None:
    with open(REGISTRY_PATH, "w", encoding="utf-8") as fh:
        json.dump(registry, fh, indent=2)


def _rmse(actual: pd.Series, predicted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual.to_numpy(dtype=float) - predicted) ** 2)))


def _training_frame(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.sort_values(["year", "month"]).reset_index(drop=True)[
        ["year", "month", "waste_tons", "date"]
    ]


def _registry_record(
    registry: list[dict[str, object]],
    registry_path: Path,
    **values: object,
) -> dict[str, object]:
    record = {
        "version": f"v1.{len(registry) + 1}",
        "timestamp": datetime.now().isoformat(),
        "liveHoldoutRmse": None,
        "candidateHoldoutRmse": None,
        "liveTrainingRmse": None,
        "candidateTrainingRmse": None,
        "holdoutStart": None,
        "holdoutEnd": None,
        "decay": 0.95,
        "trainingRows": 0,
        "eligibleCrudMonths": [],
        "decision": "skipped",
        "reason": "",
    }
    record.update(values)
    registry.append(record)
    with open(registry_path, "w", encoding="utf-8") as fh:
        json.dump(registry, fh, indent=2)
    return record


def run_retrain_pipeline(
    force: bool = False,
    batch_size: int = 30,
    root_dir: Path | None = None,
) -> dict[str, object]:
    root = Path(root_dir) if root_dir is not None else ROOT_DIR
    models_dir = root / "waste_forecast" / "models"
    live_model_path = models_dir / "trend_model.json"
    registry_path = models_dir / "model_registry.json"
    data_file = root / "backend" / "data" / "waste_entries.json"
    archive_dir = root / "waste_forecast" / "archive"
    print("[retrain_pipeline] Initiating validation-gated retrain check...")

    entries = []
    if data_file.exists():
        with open(data_file, "r", encoding="utf-8") as fh:
            entries = json.load(fh)

    unprocessed = [e for e in entries if not e.get("processed_for_training", False)]
    if len(unprocessed) < batch_size and not force:
        msg = f"Retrain skipped: {len(unprocessed)} unprocessed entries (threshold = {batch_size})."
        print(f"[retrain_pipeline] {msg}")
        registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else []
        record = _registry_record(
            registry,
            registry_path,
            decision="skipped",
            reason=msg,
            unprocessedCount=len(unprocessed),
        )
        return {"status": "skipped", **record}

    # Full location coverage is the primary gate; 10 days avoids assuming daily collection
    # because the historical source contains monthly aggregates, not collection schedules.
    min_coverage_days = int(os.getenv("RETRAIN_MIN_COVERAGE_DAYS", "10"))
    allow_historical_overwrite = os.getenv(
        "RETRAIN_ALLOW_HISTORICAL_OVERWRITE", ""
    ).lower() in {"1", "true", "yes"}

    # Build monthly features and targets
    _, total_all = load_waste_data(root)
    before_months = [
        f"{int(row.year):04d}-{int(row.month):02d}"
        for row in total_all[["year", "month"]].itertuples(index=False)
    ]
    print(
        "[retrain_pipeline] BEFORE CRUD merge: "
        f"months={before_months}"
    )

    # Incorporate new entries into total_all if any exist
    eligible_months = []
    if unprocessed:
        new_df = pd.DataFrame(unprocessed)
        new_df["entry_date"] = pd.to_datetime(new_df["entry_date"])
        new_df["year"] = new_df["entry_date"].dt.year
        new_df["month"] = new_df["entry_date"].dt.month
        expected_locations = set(INSTITUTE_SHARES)
        location_monthly = new_df.groupby(
            ["year", "month", "location_id"], as_index=False
        ).agg(
            weight_kg=("weight_kg", "sum"),
            collection_days=("entry_date", lambda values: values.dt.normalize().nunique()),
        )
        monthly_new = location_monthly.groupby(
            ["year", "month"], as_index=False
        ).agg(
            weight_kg=("weight_kg", "sum"),
            observed_location_ids=("location_id", lambda values: sorted(set(values))),
        )
        monthly_days = new_df.groupby(["year", "month"])["entry_date"].apply(
            lambda values: values.dt.normalize().nunique()
        )
        monthly_new["collection_days"] = [
            int(monthly_days.loc[(row["year"], row["month"])])
            for _, row in monthly_new.iterrows()
        ]
        monthly_new["waste_tons"] = monthly_new["weight_kg"] / 1000.0

        for _, row in monthly_new.iterrows():
            month_start = pd.Timestamp(year=int(row["year"]), month=int(row["month"]), day=1)
            month_end = month_start + pd.offsets.MonthEnd(0)
            collection_days = int(row["collection_days"])
            observed_locations = set(row["observed_location_ids"])
            missing_locations = sorted(expected_locations - observed_locations)
            observed_location_count = len(observed_locations)
            month_label = month_start.strftime("%Y-%m")
            if month_end >= pd.Timestamp.now().normalize():
                reason = "month has not ended"
                print(
                    "[retrain_pipeline][WARNING] Excluding CRUD month "
                    f"{month_label}: {reason}; collection_days={collection_days}; "
                    f"observed_location_count={observed_location_count}; "
                    f"missing_location_ids={missing_locations}"
                )
                continue
            if missing_locations:
                reason = "missing expected locations"
                print(
                    "[retrain_pipeline][WARNING] Excluding CRUD month "
                    f"{month_label}: {reason}; collection_days={collection_days}; "
                    f"observed_location_count={observed_location_count}; "
                    f"missing_location_ids={missing_locations}"
                )
                continue
            if collection_days < min_coverage_days:
                reason = f"below minimum coverage of {min_coverage_days} days"
                print(
                    "[retrain_pipeline][WARNING] Excluding CRUD month "
                    f"{month_label}: {reason}; collection_days={collection_days}; "
                    f"observed_location_count={observed_location_count}; "
                    f"missing_location_ids={missing_locations}"
                )
                continue

            mask = (total_all["year"] == row["year"]) & (total_all["month"] == row["month"])
            if mask.any():
                historical_range = (
                    pd.Timestamp("2023-01-01") <= month_start <= pd.Timestamp("2025-12-01")
                )
                if historical_range and not allow_historical_overwrite:
                    print(
                        "[retrain_pipeline][ERROR] Refusing to overwrite historical "
                        f"month {month_label}; set RETRAIN_ALLOW_HISTORICAL_OVERWRITE=true "
                        "to explicitly allow it."
                    )
                    continue
                # A complete CRUD month is the authoritative measurement, not a supplement.
                total_all.loc[mask, "waste_tons"] = row["waste_tons"]
            else:
                total_all = pd.concat(
                    [
                        total_all,
                        pd.DataFrame(
                            [
                                {
                                    "year": int(row["year"]),
                                    "month": int(row["month"]),
                                    "waste_tons": float(row["waste_tons"]),
                                    "date": month_start,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )
            eligible_months.append(month_label)

    total_all = total_all.sort_values(["year", "month"]).reset_index(drop=True)
    after_months = [
        f"{int(row.year):04d}-{int(row.month):02d}"
        for row in total_all[["year", "month"]].itertuples(index=False)
    ]
    print(
        "[retrain_pipeline] AFTER CRUD merge: "
        f"months={after_months}, "
        f"eligible_crud_months={eligible_months}"
    )

    if not eligible_months:
        msg = (
            "Retrain skipped: zero eligible CRUD months; no candidate was fitted, "
            "promoted, or marked processed."
        )
        print(f"[retrain_pipeline][WARNING] {msg}")
        registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else []
        return _registry_record(
            registry,
            registry_path,
            decision="skipped",
            reason=msg,
            eligibleCrudMonths=[],
            trainingRows=len(total_all),
        )

    total_all = total_all.sort_values(["year", "month"]).reset_index(drop=True)
    holdout_n = 6
    if len(total_all) <= holdout_n:
        raise ValueError("At least 7 monthly rows are required for a six-month holdout")
    train = _training_frame(total_all.iloc[:-holdout_n])
    holdout = _training_frame(total_all.iloc[-holdout_n:])
    candidate_model = WeightedTrendModel(decay=0.95).fit(train)
    candidate_train_pred = candidate_model.predict(
        train["month"], range(len(train))
    )
    candidate_holdout_pred = candidate_model.predict(
        holdout["month"],
        range(len(train), len(total_all)),
    )

    live_reason = ""
    live_model = None
    live_holdout_rmse = None
    live_training_rmse = None
    if not live_model_path.exists():
        live_reason = f"live artifact missing: {live_model_path}"
    else:
        try:
            live_model = WeightedTrendModel.load(live_model_path)
            if live_model.origin_year_month != candidate_model.origin_year_month:
                live_reason = "live artifact has a different origin_year_month"
            elif live_model.to_dict()["model_type"] != "weighted_ols_trend_with_unweighted_month_effects":
                live_reason = "live artifact has a different model_type"
            else:
                live_train_pred = live_model.predict(train["month"], range(len(train)))
                live_holdout_pred = live_model.predict(
                    holdout["month"], range(len(train), len(total_all))
                )
                if not np.isfinite(live_holdout_pred).all():
                    live_reason = "live artifact produced non-finite holdout predictions"
                elif not ((live_holdout_pred >= 1000.0) & (live_holdout_pred <= 100000.0)).all():
                    live_reason = "live artifact predictions are outside the metric-ton target scale"
                else:
                    live_training_rmse = _rmse(train["waste_tons"], live_train_pred)
                    live_holdout_rmse = _rmse(holdout["waste_tons"], live_holdout_pred)
        except (OSError, KeyError, TypeError, ValueError) as exc:
            live_reason = f"live artifact cannot be fairly evaluated: {exc}"

    allow_unevaluable = os.getenv("RETRAIN_ALLOW_UNEVALUABLE_LIVE", "").lower() in {
        "1", "true", "yes"
    }
    if live_reason and not allow_unevaluable:
        msg = f"REFUSED: {live_reason}; set RETRAIN_ALLOW_UNEVALUABLE_LIVE=true to override"
        print(f"[retrain_pipeline][ERROR] {msg}")
        registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else []
        return _registry_record(
            registry,
            registry_path,
            decision="refused",
            reason=msg,
            trainingRows=len(train),
            holdoutStart=str(holdout.iloc[0]["date"].date()),
            holdoutEnd=str(holdout.iloc[-1]["date"].date()),
            candidateHoldoutRmse=round(_rmse(holdout["waste_tons"], candidate_holdout_pred), 4),
            candidateTrainingRmse=round(_rmse(train["waste_tons"], candidate_train_pred), 4),
            eligibleCrudMonths=eligible_months,
        )

    candidate_holdout_rmse = _rmse(holdout["waste_tons"], candidate_holdout_pred)
    candidate_training_rmse = _rmse(train["waste_tons"], candidate_train_pred)
    is_promoted = live_reason != "" or candidate_holdout_rmse < float(live_holdout_rmse)
    reason = (
        "candidate holdout RMSE is lower than live"
        if is_promoted
        else "candidate holdout RMSE is not lower than live"
    )
    if is_promoted:
        if live_model_path.exists():
            archive_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
            shutil.copy2(live_model_path, archive_dir / f"trend_model.{timestamp}.json")
        else:
            print(
                "[retrain_pipeline][WARNING] No outgoing live artifact existed to archive",
                file=sys.stderr,
            )
        candidate_model.save(live_model_path)
        decision = "promoted"
    else:
        decision = "not_promoted"
    print(f"[retrain_pipeline] {decision.upper()}: {reason}")

    registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else []
    record = _registry_record(
        registry,
        registry_path,
        liveHoldoutRmse=round(float(live_holdout_rmse), 4) if live_holdout_rmse is not None else None,
        candidateHoldoutRmse=round(candidate_holdout_rmse, 4),
        liveTrainingRmse=round(float(live_training_rmse), 4) if live_training_rmse is not None else None,
        candidateTrainingRmse=round(candidate_training_rmse, 4),
        holdoutStart=str(holdout.iloc[0]["date"].date()),
        holdoutEnd=str(holdout.iloc[-1]["date"].date()),
        trainingRows=len(train),
        eligibleCrudMonths=eligible_months,
        decision=decision,
        reason=reason,
    )

    eligible_set = set(eligible_months)
    for entry in entries:
        entry_month = pd.Timestamp(entry["entry_date"]).strftime("%Y-%m")
        if entry_month in eligible_set:
            entry["processed_for_training"] = True
    with open(data_file, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2)
    return record


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    res = run_retrain_pipeline(force=force_flag)
    print(json.dumps(res, indent=2))
