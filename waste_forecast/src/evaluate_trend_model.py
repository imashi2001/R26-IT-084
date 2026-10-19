"""Evaluate the auditable weighted trend model without training a live artifact."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    from load_data import TARGET_LOCATION_IDS, load_waste_data
    from trend_model import WeightedTrendModel
except ImportError:  # pragma: no cover
    from src.load_data import TARGET_LOCATION_IDS, load_waste_data
    from src.trend_model import WeightedTrendModel

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "waste_forecast" / "evaluation" / "trend_model_metrics.json"


def target_frame() -> pd.DataFrame:
    _, frame = load_waste_data(ROOT)
    return frame.sort_values(["year", "month"]).reset_index(drop=True)


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | int]:
    return {
        "n": int(len(actual)),
        "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
        "mae": float(mean_absolute_error(actual, predicted)),
        "mape_percent": float(
            np.mean(np.abs((actual - predicted) / actual)) * 100
        ),
        "r2": float(r2_score(actual, predicted)) if len(actual) > 1 else float("nan"),
        "bias_predicted_minus_actual": float(np.mean(predicted - actual)),
    }


def trend_predictions(
    train: pd.DataFrame,
    target: pd.DataFrame,
    target_indices: list[int],
    decay: float,
    include_month_effects: bool,
) -> np.ndarray:
    model = WeightedTrendModel(decay=decay).fit(train)
    return model.predict(
        target["month"],
        target_indices,
        include_month_effects=include_month_effects,
    )


def staged_predictions(
    train: pd.DataFrame,
    target: pd.DataFrame,
    decay: float,
    target_indices: list[int],
) -> tuple[np.ndarray, dict[int, int]]:
    model = WeightedTrendModel(decay=decay).fit(train)
    predictions = model.predict(target["month"], target_indices)
    return predictions, model.month_observations


def comparison_predictions(
    full: pd.DataFrame,
    train_end: int,
    target_indices: list[int],
    name: str,
) -> np.ndarray:
    train = full.iloc[:train_end]
    if name == "weighted_trend_plus_unweighted_month_effects":
        return trend_predictions(
            train,
            full.iloc[target_indices],
            target_indices,
            decay=0.95,
            include_month_effects=True,
        )
    if name == "unweighted_trend_plus_unweighted_month_effects":
        return trend_predictions(
            train,
            full.iloc[target_indices],
            target_indices,
            decay=1.0,
            include_month_effects=True,
        )
    if name == "weighted_trend_without_month_effects":
        return trend_predictions(
            train,
            full.iloc[target_indices],
            target_indices,
            decay=0.95,
            include_month_effects=False,
        )
    if name == "trend_without_decay_or_month_effects":
        return trend_predictions(
            train,
            full.iloc[target_indices],
            target_indices,
            decay=1.0,
            include_month_effects=False,
        )
    if name == "naive":
        return np.repeat(float(train["waste_tons"].iloc[-1]), len(target_indices))
    if name == "seasonal_naive":
        return full["waste_tons"].iloc[
            [index - 12 for index in target_indices]
        ].to_numpy(dtype=float)
    raise ValueError(f"Unknown comparison model: {name}")


def evaluate_fixed(
    frame: pd.DataFrame,
    decay: float,
) -> tuple[list[dict[str, object]], dict[int, int]]:
    train_end = 30
    target_indices = list(range(30, 36))
    train = frame.iloc[:train_end]
    target = frame.iloc[target_indices]
    staged, observations = staged_predictions(train, target, decay, target_indices)
    rows = [
        {
            "protocol": "fixed_holdout",
            "model": "weighted_trend_plus_unweighted_month_effects",
            **metrics(target.waste_tons.to_numpy(float), staged),
        }
    ]
    for name in (
        "unweighted_trend_plus_unweighted_month_effects",
        "weighted_trend_without_month_effects",
        "trend_without_decay_or_month_effects",
        "naive",
        "seasonal_naive",
    ):
        rows.append(
            {
                "protocol": "fixed_holdout",
                "model": name,
                **metrics(
                    target.waste_tons.to_numpy(float),
                    comparison_predictions(frame, train_end, target_indices, name),
                ),
            }
        )
    return rows, observations


def evaluate_rolling(
    frame: pd.DataFrame,
    horizon: int,
    decay: float,
) -> list[dict[str, object]]:
    first_origin = len(frame) - 12 - horizon
    last_origin = len(frame) - horizon - 1
    target_indices = [index + horizon for index in range(first_origin, last_origin + 1)]
    assert target_indices == list(range(24, 36))
    actual = frame["waste_tons"].iloc[target_indices].to_numpy(float)
    predictions: dict[str, list[float]] = {
        "weighted_trend_plus_unweighted_month_effects": [],
        "unweighted_trend_plus_unweighted_month_effects": [],
        "weighted_trend_without_month_effects": [],
        "trend_without_decay_or_month_effects": [],
        "naive": [],
        "seasonal_naive": [],
    }
    for origin, target_index in zip(
        range(first_origin, last_origin + 1), target_indices
    ):
        train = frame.iloc[: origin + 1]
        target = frame.iloc[[target_index]]
        staged, _ = staged_predictions(train, target, decay, [target_index])
        predictions["weighted_trend_plus_unweighted_month_effects"].append(
            float(staged[0])
        )
        for name in (
            "unweighted_trend_plus_unweighted_month_effects",
            "weighted_trend_without_month_effects",
            "trend_without_decay_or_month_effects",
            "naive",
            "seasonal_naive",
        ):
            predictions[name].append(
                float(
                    comparison_predictions(frame, origin + 1, [target_index], name)[0]
                )
            )
    rows = []
    for name, predicted in predictions.items():
        rows.append(
            {
                "protocol": f"rolling_{horizon}_month_ahead",
                "model": name,
                "origin_index_start": first_origin,
                "origin_index_end": last_origin,
                "target_index_start": target_indices[0],
                "target_index_end": target_indices[-1],
                **metrics(actual, np.asarray(predicted)),
            }
        )
    return rows


def main() -> None:
    frame = target_frame()
    fixed_rows, month_observations = evaluate_fixed(frame, decay=0.95)
    rows = fixed_rows + evaluate_rolling(frame, 1, 0.95) + evaluate_rolling(
        frame, 3, 0.95
    )
    payload = {
        "source": "waste_forecast/data/location_monthly.csv",
        "target_location_ids": sorted(TARGET_LOCATION_IDS),
        "decay": 0.95,
        "fixed_holdout": {
            "train_start": "2023-01",
            "train_end": "2025-06",
            "test_start": "2025-07",
            "test_end": "2025-12",
            "training_rows": 30,
        },
        "rolling_origin": {
            "horizons": {
                "1": {"origin_index_start": 23, "origin_index_end": 34},
                "3": {"origin_index_start": 21, "origin_index_end": 32},
            },
            "target_index_start": 24,
            "target_index_end": 35,
            "target_start": "2025-01",
            "target_end": "2025-12",
        },
        "month_effect_observations_fixed_training": {
            str(month): count for month, count in month_observations.items()
        },
        "ablation_interpretation": (
            "The calendar-month effects are responsible for most of the model's "
            "accuracy, while decay weighting adds a smaller improvement concentrated "
            "in reduced bias and better longer-horizon error."
        ),
        "results": rows,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("protocol,model,rmse,mae,mape_percent,r2,bias_predicted_minus_actual")
    for row in rows:
        print(
            f"{row['protocol']},{row['model']},{row['rmse']:.3f},"
            f"{row['mae']:.3f},{row['mape_percent']:.3f},{row['r2']:.3f},"
            f"{row['bias_predicted_minus_actual']:.3f}"
        )
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
