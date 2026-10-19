"""Small, auditable weighted trend model for the monthly waste target.

The calendar-month effects are plain means of the training residuals. With a
30-month training set, January through June have three observations each and
July through December have two observations each. These small group sizes are
an explicit limitation of the month effects.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

LOGGER = logging.getLogger(__name__)


class WeightedTrendModel:
    """Weighted OLS trend with unweighted calendar-month residual effects."""

    def __init__(self, decay: float = 0.95) -> None:
        if not 0 < decay <= 1:
            raise ValueError("decay must be greater than 0 and no greater than 1")
        self.decay = float(decay)
        self.intercept: float | None = None
        self.slope: float | None = None
        self.month_effects: dict[int, float] = {}
        self.month_observations: dict[int, int] = {}
        self.n_training_rows: int = 0
        self.origin_year_month: str | None = None

    def fit(self, frame: pd.DataFrame) -> "WeightedTrendModel":
        required = {"month", "waste_tons"}
        missing = required.difference(frame.columns)
        if missing:
            raise ValueError(f"Missing required columns: {sorted(missing)}")
        if frame.empty:
            raise ValueError("Cannot fit on an empty monthly series")

        data = frame.reset_index(drop=True).copy()
        if {"year", "month"}.issubset(data.columns):
            origin_year = int(data.iloc[0]["year"])
            origin_month = int(data.iloc[0]["month"])
        elif "date" in data.columns:
            origin = pd.Period(data.iloc[0]["date"], freq="M")
            origin_year = origin.year
            origin_month = origin.month
        else:
            raise ValueError(
                "Training frame must include year and month columns or a date column "
                "to define the model origin"
            )
        if not 1 <= origin_month <= 12:
            raise ValueError(f"Invalid origin month: {origin_month}")
        self.origin_year_month = f"{origin_year:04d}-{origin_month:02d}"
        y = data["waste_tons"].to_numpy(dtype=float)
        if not np.isfinite(y).all():
            raise ValueError("waste_tons must contain only finite values")

        self.n_training_rows = len(data)
        time_index = np.arange(self.n_training_rows, dtype=float)
        age = (self.n_training_rows - 1) - time_index
        weights = self.decay**age
        design = np.column_stack((np.ones(self.n_training_rows), time_index))
        weighted_design = design * weights[:, None]
        normal_matrix = weighted_design.T @ design
        coefficients = np.linalg.solve(normal_matrix, weighted_design.T @ y)
        self.intercept = float(coefficients[0])
        self.slope = float(coefficients[1])

        residuals = y - (self.intercept + self.slope * time_index)
        self.month_effects = {}
        self.month_observations = {}
        for month in range(1, 13):
            mask = data["month"].to_numpy(dtype=int) == month
            count = int(mask.sum())
            self.month_observations[month] = count
            if count:
                self.month_effects[month] = float(residuals[mask].mean())
            else:
                self.month_effects[month] = 0.0
                LOGGER.warning(
                    "No training observations for calendar month %02d; using zero effect",
                    month,
                )
        return self

    def predict(
        self,
        months: Iterable[int],
        absolute_time_indices: Iterable[int],
        include_month_effects: bool = True,
    ) -> np.ndarray:
        if self.intercept is None or self.slope is None:
            raise ValueError("Model must be fitted before prediction")

        month_values = [int(month) for month in months]
        time_values = [int(index) for index in absolute_time_indices]
        if len(month_values) != len(time_values):
            raise ValueError("months and absolute_time_indices must have equal length")

        predictions = []
        for month, time_index in zip(month_values, time_values):
            if not 1 <= month <= 12:
                raise ValueError(f"Invalid calendar month: {month}")
            expected_target_index = time_index
            assert expected_target_index == time_index, (
                "Predicted time index must equal the target absolute time index"
            )
            predictions.append(
                self.intercept
                + self.slope * expected_target_index
                + (
                    self.month_effects.get(month, 0.0)
                    if include_month_effects
                    else 0.0
                )
            )
        return np.asarray(predictions, dtype=float)

    def to_dict(self) -> dict[str, object]:
        if self.intercept is None or self.slope is None:
            raise ValueError("Cannot serialize an unfitted model")
        return {
            "model_type": "weighted_ols_trend_with_unweighted_month_effects",
            "decay": self.decay,
            "intercept": self.intercept,
            "slope": self.slope,
            "origin_year_month": self.origin_year_month,
            "month_effects": {str(k): v for k, v in self.month_effects.items()},
            "month_observations": {
                str(k): v for k, v in self.month_observations.items()
            },
            "n_training_rows": self.n_training_rows,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "WeightedTrendModel":
        if "origin_year_month" not in payload:
            raise ValueError(
                "Trend model artifact is missing origin_year_month. "
                "Re-run waste_forecast/src/fit_production_model.py."
            )
        model = cls(decay=float(payload["decay"]))
        model.intercept = float(payload["intercept"])
        model.slope = float(payload["slope"])
        model.origin_year_month = str(payload["origin_year_month"])
        model.month_effects = {
            int(k): float(v) for k, v in dict(payload["month_effects"]).items()
        }
        model.month_observations = {
            int(k): int(v) for k, v in dict(payload["month_observations"]).items()
        }
        model.n_training_rows = int(payload["n_training_rows"])
        return model

    def save(self, path: str | Path) -> None:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(self.to_dict(), indent=2) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: str | Path) -> "WeightedTrendModel":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(payload)
