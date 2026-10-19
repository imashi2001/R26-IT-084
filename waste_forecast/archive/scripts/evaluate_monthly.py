"""Evaluate measured monthly waste totals with past-only expanding-origin CV."""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    from monthly_dataset import build_monthly_dataset
except ImportError:  # pragma: no cover
    from src.monthly_dataset import build_monthly_dataset

ROOT = Path(__file__).resolve().parents[3]  # archive/scripts -> repo root
OUTPUT_DIR = ROOT / "waste_forecast" / "evaluation" / "monthly"
SEED = 42
BOOTSTRAP_ITERATIONS = 500


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | int | None]:
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    nonzero = np.abs(actual) > np.finfo(float).eps
    return {
        "n": int(len(actual)),
        "RMSE": float(np.sqrt(mean_squared_error(actual, predicted))),
        "MAE": float(mean_absolute_error(actual, predicted)),
        "MAPE_percent": float(np.mean(np.abs((actual[nonzero] - predicted[nonzero]) / actual[nonzero])) * 100) if nonzero.any() else None,
        "R2": float(r2_score(actual, predicted)) if len(actual) > 1 else None,
    }


def ci(actual: np.ndarray, predicted: np.ndarray, name: str) -> dict[str, float | int]:
    rng = np.random.default_rng(SEED)
    values = []
    for _ in range(BOOTSTRAP_ITERATIONS):
        sample = rng.integers(0, len(actual), len(actual))
        values.append(metrics(actual[sample], predicted[sample])[name])
    point = metrics(actual, predicted)[name]
    return {"estimate": point, "lower": float(np.percentile(values, 2.5)), "upper": float(np.percentile(values, 97.5)), "iterations": BOOTSTRAP_ITERATIONS, "seed": SEED}


def improvement_ci(actual: np.ndarray, predicted: np.ndarray, baseline: np.ndarray) -> dict[str, float | int]:
    rng = np.random.default_rng(SEED)
    values = []
    for _ in range(BOOTSTRAP_ITERATIONS):
        sample = rng.integers(0, len(actual), len(actual))
        model_rmse = np.sqrt(mean_squared_error(actual[sample], predicted[sample]))
        baseline_rmse = np.sqrt(mean_squared_error(actual[sample], baseline[sample]))
        values.append((baseline_rmse - model_rmse) / baseline_rmse * 100 if baseline_rmse else 0.0)
    model_rmse = np.sqrt(mean_squared_error(actual, predicted)); baseline_rmse = np.sqrt(mean_squared_error(actual, baseline))
    return {"estimate_percent": float((baseline_rmse - model_rmse) / baseline_rmse * 100), "lower_percent": float(np.percentile(values, 2.5)), "upper_percent": float(np.percentile(values, 97.5)), "iterations": BOOTSTRAP_ITERATIONS, "seed": SEED}


def model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(max_iter=80, learning_rate=0.04, max_leaf_nodes=5, min_samples_leaf=1, l2_regularization=1.0, random_state=SEED)


def evaluate() -> dict[str, object]:
    frame, features = build_monthly_dataset()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT_DIR / "monthly_dataset.csv", index=False)
    actual = frame["waste_tons"].to_numpy(float)
    predictions = []
    folds = []
    # The first month has no past observations; all other months are evaluated once.
    for test_index in range(1, len(frame)):
        train_index = np.arange(test_index)
        if len(train_index) < 20:
            prediction = float(actual[train_index].mean())
        else:
            estimator = model()
            estimator.fit(frame.iloc[train_index][features], actual[train_index])
            prediction = float(estimator.predict(frame.iloc[[test_index]][features])[0])
        predictions.append({"index": test_index, "date": frame.iloc[test_index]["date"], "actual": actual[test_index], "predicted": prediction})
        folds.append({"fold": test_index, "train_n": int(test_index), "test_date": frame.iloc[test_index]["date"].date().isoformat(), **metrics(actual[[test_index]], np.array([prediction]))})
    prediction_frame = pd.DataFrame(predictions)
    y_true, y_pred = prediction_frame.actual.to_numpy(), prediction_frame.predicted.to_numpy()
    fold_metric_values = {name: np.array([row[name] for row in folds if row[name] is not None], float) for name in ("RMSE", "MAE", "MAPE_percent")}
    headline = {name: {"mean": float(values.mean()), "std": float(values.std(ddof=1)), "values": values.tolist()} for name, values in fold_metric_values.items()}
    overall = metrics(y_true, y_pred)
    headline["R2"] = {"mean": overall["R2"], "std": None, "values": [overall["R2"]], "interpretation": "R² is computed on all out-of-fold predictions because single-observation LOOCV folds have undefined per-fold R²."}
    headline_ci = {name: ci(y_true, y_pred, name) for name in ("RMSE", "MAE", "MAPE_percent", "R2")}

    # Baselines are generated strictly from historical observations at each forecast origin.
    baseline_rows = []
    for row in predictions:
        index = int(row["index"]); baseline_rows.append({"naive": actual[index - 1], "seasonal_naive": actual[index - 12] if index >= 12 else np.nan, "moving_average_3": actual[max(0, index - 3):index].mean()})
    baseline_frame = pd.DataFrame(baseline_rows)
    seasonal_mask = baseline_frame["seasonal_naive"].notna().to_numpy()
    baseline_results = {}
    for name in ("naive", "seasonal_naive", "moving_average_3"):
        mask = np.isfinite(baseline_frame[name].to_numpy())
        baseline_values = baseline_frame.loc[mask, name].to_numpy()
        model_values = y_pred[mask]
        true_values = y_true[mask]
        baseline_results[name] = {"metrics": metrics(true_values, baseline_values), "model_RMSE_improvement_CI": improvement_ci(true_values, model_values, baseline_values)}

    final_model = model(); final_model.fit(frame[features], actual)
    with (OUTPUT_DIR / "monthly_model.pkl").open("wb") as handle:
        pickle.dump({"model": final_model, "feature_columns": features, "seed": SEED}, handle)
    all_predictions = prediction_frame.join(baseline_frame)
    all_predictions.to_csv(OUTPUT_DIR / "predictions.csv", index=False)
    from sklearn.inspection import permutation_importance
    permutation = permutation_importance(final_model, frame[features], actual, n_repeats=10, random_state=SEED, scoring="neg_root_mean_squared_error")
    importance = pd.Series(permutation.importances_mean, index=features)
    plt.figure(figsize=(10, 5)); plt.plot(prediction_frame.date, y_true, label="Actual"); plt.plot(prediction_frame.date, y_pred, label="Predicted"); plt.legend(); plt.title("Monthly Actual vs Predicted"); plt.ylabel("Waste (tons)"); plt.tight_layout(); plt.savefig(OUTPUT_DIR / "actual_vs_predicted.png", dpi=300); plt.close()
    plt.figure(figsize=(10, 4)); plt.axhline(0, color="black", linewidth=0.8); plt.plot(prediction_frame.date, y_true - y_pred); plt.title("Monthly Residuals"); plt.ylabel("Actual - Predicted"); plt.tight_layout(); plt.savefig(OUTPUT_DIR / "residuals.png", dpi=300); plt.close()
    plt.figure(figsize=(8, 4)); importance.sort_values().plot.barh(); plt.title("Monthly Feature Importance"); plt.tight_layout(); plt.savefig(OUTPUT_DIR / "feature_importance.png", dpi=300); plt.close()

    results = {"data": {"source": "load_data.DEFAULT_MONTHLY_WASTE; no Excel files were present", "target": "waste_tons", "n": len(frame), "date_start": frame.date.min().date().isoformat(), "date_end": frame.date.max().date().isoformat(), "date_convention": "month-end"}, "method": {"cross_validation": "past-only expanding-origin leave-one-out; first month excluded because no training history exists", "evaluated_folds": len(folds), "bootstrap_iterations": BOOTSTRAP_ITERATIONS, "seed": SEED}, "headline": headline, "headline_bootstrap_95_CI": headline_ci, "folds": folds, "baselines": baseline_results, "limitations": ["The requested Excel files were not present; the checked-in measured monthly table was used.", "A true first-month forecast is impossible without prior history, so Jan 2023 is excluded from evaluable folds."]}
    with (OUTPUT_DIR / "metrics.json").open("w", encoding="utf-8") as handle: json.dump(results, handle, indent=2)
    write_summary(results)
    print(f"Monthly evaluation complete: n={len(frame)}, evaluable folds={len(folds)}")
    print(f"RMSE={headline['RMSE']['mean']:.4f} +/- {headline['RMSE']['std']:.4f}; R2={headline['R2']['mean']:.4f} (aggregate out-of-fold)")
    return results


def write_summary(results: dict[str, object]) -> None:
    headline = results["headline"]
    lines = ["# Monthly Forecasting Evaluation", "", "## Data Availability Statement", "", "This study uses monthly aggregated waste totals (n=33 months, Jan 2023–Sep 2025) as daily-resolution measurements are not routinely recorded at Sri Lankan municipal waste facilities. Monthly forecasting reflects the operational data availability.", "", "## Cross-Validation", "", "Past-only expanding-origin leave-one-out evaluation is used. Jan 2023 is not evaluable because no earlier training month exists.", "", "| Metric | Mean ± SD across evaluable folds | Aggregate OOF 95% CI |", "|---|---:|---:|"]
    for name in ("RMSE", "MAE", "MAPE_percent", "R2"):
        value = f"{headline[name]['mean']:.3f} ± {headline[name]['std']:.3f}" if headline[name]["std"] is not None else f"{headline[name]['mean']:.3f} (aggregate OOF)"
        interval = results["headline_bootstrap_95_CI"][name]
        lines.append(f"| {name} | {value} | {interval['lower']:.3f}–{interval['upper']:.3f} |")
    lines += ["", "## Fold Results", "", "| Fold | Training months | Test month | RMSE | MAE | MAPE (%) | R² |", "|---:|---:|---|---:|---:|---:|---:|"]
    for fold in results["folds"]:
        r2 = "NA" if fold["R2"] is None else f"{fold['R2']:.3f}"
        lines.append(f"| {fold['fold']} | {fold['train_n']} | {fold['test_date']} | {fold['RMSE']:.3f} | {fold['MAE']:.3f} | {fold['MAPE_percent']:.2f} | {r2} |")
    lines += ["", "## Baseline Comparison", "", "| Baseline | RMSE | R² | Model improvement (95% CI) |", "|---|---:|---:|---:|"]
    for name, result in results["baselines"].items():
        metric = result["metrics"]; improvement = result["model_RMSE_improvement_CI"]
        finding = f"{improvement['estimate_percent']:.2f}% ({improvement['lower_percent']:.2f}–{improvement['upper_percent']:.2f})"
        lines.append(f"| {name} | {metric['RMSE']:.3f} | {metric['R2']:.3f} | {finding} |")
    lines += ["", "The model is compared directly with each baseline. Improvements below 15% are reported as modest rather than presented as practically meaningful.", "", "## Interpretation", "", "All metrics use measured monthly totals. Bootstrap confidence intervals use 500 resamples with seed 42. Results should be interpreted cautiously because only 33 monthly observations are available."]
    (OUTPUT_DIR / "metrics_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    evaluate()