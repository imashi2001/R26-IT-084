"""Copy-only tests for the two required retraining-gate outcomes."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pandas as pd

import retrain_pipeline
from load_data import INSTITUTE_SHARES
from trend_model import WeightedTrendModel


def _write_copy_project(root: Path, crud_entries: list[dict[str, object]]) -> None:
    data_dir = root / "waste_forecast" / "data"
    model_dir = root / "waste_forecast" / "models"
    backend_dir = root / "backend" / "data"
    data_dir.mkdir(parents=True)
    model_dir.mkdir(parents=True)
    backend_dir.mkdir(parents=True)

    rows = []
    for year, month_index in [(2023, month) for month in range(1, 13)] + [
        (2024, month) for month in range(1, 13)
    ] + [(2025, month) for month in range(1, 13)]:
        for location_index, location_id in enumerate(INSTITUTE_SHARES):
            rows.append(
                {
                    "location_id": location_id,
                    "year": year,
                    "month": month_index,
                    "waste_tons": 9000 + (year - 2023) * 500 + month_index * 20 + location_index,
                }
            )
    pd.DataFrame(rows).to_csv(data_dir / "location_monthly.csv", index=False)
    (backend_dir / "waste_entries.json").write_text(
        json.dumps(crud_entries, indent=2), encoding="utf-8"
    )


def _crud_entries(days: int, processed: bool = False) -> list[dict[str, object]]:
    entries = []
    for day in range(1, days + 1):
        for location_id in INSTITUTE_SHARES:
            entries.append(
                {
                    "entry_date": f"2026-01-{day:02d}",
                    "location_id": location_id,
                    "waste_type": "mixed",
                    "weight_kg": 1000.0,
                    "processed_for_training": processed,
                }
            )
    return entries


def _load_registry(root: Path) -> list[dict[str, object]]:
    return json.loads(
        (root / "waste_forecast" / "models" / "model_registry.json").read_text(
            encoding="utf-8"
        )
    )


def test_zero_eligible_months() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        entries = _crud_entries(days=1)
        _write_copy_project(root, entries)
        result = retrain_pipeline.run_retrain_pipeline(
            force=True, batch_size=1, root_dir=root
        )
        saved_entries = json.loads(
            (root / "backend" / "data" / "waste_entries.json").read_text(
                encoding="utf-8"
            )
        )
        assert result["decision"] == "skipped"
        assert not any(entry["processed_for_training"] for entry in saved_entries)
        assert not (root / "waste_forecast" / "models" / "trend_model.json").exists()
        assert _load_registry(root)[-1]["decision"] == "skipped"
        print("CASE zero eligible CRUD months: PASS")
        print(json.dumps(result, indent=2))


def test_candidate_better_than_live() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _write_copy_project(root, _crud_entries(days=10))
        _, history = retrain_pipeline.load_waste_data(root)
        live = WeightedTrendModel(decay=0.95).fit(history)
        live.intercept = float(live.intercept) + 3000.0
        live_path = root / "waste_forecast" / "models" / "trend_model.json"
        live.save(live_path)
        before = live_path.read_bytes()
        result = retrain_pipeline.run_retrain_pipeline(
            force=True, batch_size=1, root_dir=root
        )
        after = live_path.read_bytes()
        backups = list((root / "waste_forecast" / "archive").glob("trend_model.*.json"))
        assert result["decision"] == "promoted"
        assert backups
        assert backups[0].read_bytes() == before
        assert after != before
        assert _load_registry(root)[-1]["decision"] == "promoted"
        print("CASE candidate better than live: PASS")
        print(json.dumps(result, indent=2))
        print(f"Backup exists and differs from new artifact: {backups[0].name}")


if __name__ == "__main__":
    test_zero_eligible_months()
    test_candidate_better_than_live()
