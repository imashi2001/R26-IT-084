"""Fit the pinned production trend model on all available real monthly data."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
WASTE_FORECAST_DIR = ROOT_DIR / "waste_forecast"
MODEL_PATH = WASTE_FORECAST_DIR / "models" / "trend_model.json"

sys.path.insert(0, str(WASTE_FORECAST_DIR / "src"))

from load_data import load_waste_data
from trend_model import WeightedTrendModel


def main() -> None:
    _, history = load_waste_data(ROOT_DIR)
    history = history.sort_values(["year", "month"]).reset_index(drop=True)
    model = WeightedTrendModel(decay=0.95).fit(history)
    model.save(MODEL_PATH)
    print(f"Saved production trend model to {MODEL_PATH}")
    print(f"Training rows: {model.n_training_rows}")
    print(f"Origin: {model.origin_year_month}")
    print(f"Intercept: {model.intercept:.12f}")
    print(f"Slope: {model.slope:.12f}")
    for month in range(1, 13):
        print(
            f"Month {month:02d}: effect={model.month_effects[month]:.12f}, "
            f"observations={model.month_observations[month]}"
        )


if __name__ == "__main__":
    main()
