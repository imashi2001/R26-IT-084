"""Publication-grade daily evaluation for the separately trained daily model."""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.base import clone
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

try:
    from train_daily_model import build_daily_dataset
except ImportError:  # pragma: no cover
    from src.train_daily_model import build_daily_dataset

ROOT = Path(__file__).resolve().parents[2]
FORECAST_ROOT = ROOT / "waste_forecast"
EVALUATION_DIR = FORECAST_ROOT / "evaluation"
PLOTS_DIR = EVALUATION_DIR / "plots"
MODEL_PATH = FORECAST_ROOT / "archive" / "trained_model_daily.pkl"  # retired daily model
DATA_PATH = EVALUATION_DIR / "daily_dataset.csv"
SEED = 42
BOOTSTRAP_ITERATIONS = 1000


def finite(value):
    return None if value is None or not np.isfinite(value) else float(value)


def metric_values(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    nonzero = np.abs(actual) > np.finfo(float).eps
    return {
        "n": int(len(actual)),
        "RMSE": finite(np.sqrt(mean_squared_error(actual, predicted))),
        "MAE": finite(mean_absolute_error(actual, predicted)),
        "MAPE_percent": finite(np.mean(np.abs((actual[nonzero] - predicted[nonzero]) / actual[nonzero])) * 100 if nonzero.any() else np.nan),
        "R2": finite(r2_score(actual, predicted) if len(actual) > 1 else np.nan),
    }


def bootstrap_ci(actual, predicted, metric_name):
    rng = np.random.default_rng(SEED)
    values = []
    for _ in range(BOOTSTRAP_ITERATIONS):
        sample = rng.integers(0, len(actual), len(actual))
        values.append(metric_values(actual[sample], predicted[sample])[metric_name])
    point = metric_values(actual, predicted)[metric_name]
    return {"estimate": finite(point), "lower": finite(np.percentile(values, 2.5)), "upper": finite(np.percentile(values, 97.5)), "iterations": BOOTSTRAP_ITERATIONS, "seed": SEED}


def improvement_ci(actual, predicted, baseline):
    valid = np.isfinite(actual) & np.isfinite(predicted) & np.isfinite(baseline)
    actual, predicted, baseline = actual[valid], predicted[valid], baseline[valid]
    rng = np.random.default_rng(SEED)
    values = []
    for _ in range(BOOTSTRAP_ITERATIONS):
        sample = rng.integers(0, len(actual), len(actual))
        model_rmse = np.sqrt(mean_squared_error(actual[sample], predicted[sample]))
        baseline_rmse = np.sqrt(mean_squared_error(actual[sample], baseline[sample]))
        values.append((baseline_rmse - model_rmse) / baseline_rmse * 100 if baseline_rmse else np.nan)
    model_rmse = np.sqrt(mean_squared_error(actual, predicted))
    baseline_rmse = np.sqrt(mean_squared_error(actual, baseline))
    point = (baseline_rmse - model_rmse) / baseline_rmse * 100 if baseline_rmse else np.nan
    values = np.asarray(values)[np.isfinite(values)]
    return {"estimate_percent": finite(point), "lower_percent": finite(np.percentile(values, 2.5)) if len(values) else None, "upper_percent": finite(np.percentile(values, 97.5)) if len(values) else None, "iterations": BOOTSTRAP_ITERATIONS, "seed": SEED, "n": int(len(actual))}


def add_baselines(train, test):
    result = test.copy()
    history = pd.concat([train, test]).sort_values("date")
    result["naive_1"] = history["actual"].shift(1).reindex(result.index)
    result["seasonal_7"] = history["actual"].shift(7).reindex(result.index)
    day_means = train.groupby("day_of_week_num")["actual"].mean()
    result["historical_day_of_week_mean"] = result["day_of_week_num"].map(day_means).fillna(train["actual"].mean())
    return result


def save_plots(final_test, folds, importance, learning_curve):
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.size": 10, "axes.titlesize": 12})

    def save(fig, name):
        fig.tight_layout()
        fig.savefig(PLOTS_DIR / name, dpi=300)
        plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 5)); ax.plot(final_test.date, final_test.actual, label="Actual"); ax.plot(final_test.date, final_test.predicted, label="Predicted"); ax.set(title="Actual vs Predicted Waste (Final Test Fold)", xlabel="Date", ylabel="Waste (tons)"); ax.legend(); save(fig, "actual_vs_predicted_timeseries.png")
    fig, ax = plt.subplots(figsize=(6, 6)); ax.scatter(final_test.actual, final_test.predicted, alpha=0.55); bounds = [min(final_test.actual.min(), final_test.predicted.min()), max(final_test.actual.max(), final_test.predicted.max())]; ax.plot(bounds, bounds, "k--", label="y = x"); ax.set(title="Actual vs Predicted", xlabel="Actual", ylabel="Predicted"); ax.legend(); save(fig, "actual_vs_predicted_scatter.png")
    fig, ax = plt.subplots(figsize=(10, 4)); ax.axhline(0, color="black", linewidth=0.8); ax.plot(final_test.date, final_test.residual); ax.set(title="Residuals Over Time", xlabel="Date", ylabel="Residual"); save(fig, "residuals_over_time.png")
    fig, axes = plt.subplots(1, 2, figsize=(10, 4)); axes[0].hist(final_test.residual, bins=25, edgecolor="black"); axes[0].set(title="Residual Distribution", xlabel="Residual"); stats.probplot(final_test.residual, dist="norm", plot=axes[1]); axes[1].set_title("Residual Q-Q Plot"); save(fig, "residuals_histogram_qq.png")
    top = importance.sort_values().tail(20); fig, ax = plt.subplots(figsize=(8, 6)); top.plot.barh(ax=ax); ax.set(title="Top 20 Permutation Feature Importances", xlabel="Importance decrease"); save(fig, "feature_importance_top20.png")
    dow = final_test.groupby("day_of_week_name").apply(lambda frame: metric_values(frame.actual, frame.predicted)["RMSE"], include_groups=False); fig, ax = plt.subplots(figsize=(8, 4)); dow.reindex(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).plot.bar(ax=ax); ax.set(title="RMSE by Day of Week", ylabel="RMSE"); save(fig, "rmse_by_day_of_week.png")
    fig, ax = plt.subplots(figsize=(7, 4)); ax.bar([row["fold"] for row in folds], [row["RMSE"] for row in folds]); ax.set(title="RMSE by Time-Series Fold", xlabel="Fold", ylabel="RMSE"); save(fig, "rmse_by_fold.png")
    curve = pd.DataFrame(learning_curve); fig, ax = plt.subplots(figsize=(7, 4)); ax.plot(curve.training_size, curve.rmse, marker="o"); ax.set(title="Learning Curve", xlabel="Training set size", ylabel="Test-fold RMSE"); save(fig, "learning_curve_rmse.png")


def diagnostics(frame):
    residual = frame.actual.to_numpy() - frame.predicted.to_numpy()
    centered = residual - residual.mean(); denominator = np.dot(centered, centered); lag = min(10, len(residual) // 4)
    autocorr = [np.dot(centered[k:], centered[:-k]) / denominator for k in range(1, lag + 1)] if denominator and lag else []
    q = len(residual) * (len(residual) + 2) * sum((value * value) / (len(residual) - index) for index, value in enumerate(autocorr, 1)) if autocorr else np.nan
    shapiro = stats.shapiro(residual)
    return {"mean": finite(residual.mean()), "std": finite(residual.std(ddof=1)), "shapiro_wilk": {"statistic": finite(shapiro.statistic), "p_value": finite(shapiro.pvalue)}, "ljung_box": {"lag": lag, "statistic": finite(q), "p_value": finite(1 - stats.chi2.cdf(q, lag)) if np.isfinite(q) else None}}


def evaluate():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing {MODEL_PATH}. Run train_daily_model.py first.")
    daily, feature_columns = build_daily_dataset()
    daily = daily.sort_values("date").reset_index(drop=True)
    daily["day_of_week_name"] = daily["date"].dt.day_name()
    with MODEL_PATH.open("rb") as handle:
        artifact = pickle.load(handle)
    model_template = artifact["model"]
    feature_columns = artifact.get("feature_columns", feature_columns)
    X, y = daily[feature_columns], daily["actual"].to_numpy(dtype=float)
    splitter = TimeSeriesSplit(n_splits=5)
    folds, learning_curve = [], []
    final_train = final_test = None
    for fold, (train_idx, test_idx) in enumerate(splitter.split(X), start=1):
        model = clone(model_template); model.fit(X.iloc[train_idx], y[train_idx]); predicted = model.predict(X.iloc[test_idx])
        test_frame = daily.iloc[test_idx].copy(); test_frame["predicted"] = predicted; test_frame["residual"] = test_frame.actual - predicted
        row = metric_values(y[test_idx], predicted); row.update({"fold": fold, "train_n": int(len(train_idx)), "test_n": int(len(test_idx)), "train_start": daily.iloc[train_idx].date.min().date().isoformat(), "train_end": daily.iloc[train_idx].date.max().date().isoformat(), "test_start": daily.iloc[test_idx].date.min().date().isoformat(), "test_end": daily.iloc[test_idx].date.max().date().isoformat()}); folds.append(row); learning_curve.append({"training_size": len(train_idx), "rmse": row["RMSE"]}); final_train, final_test = daily.iloc[train_idx].copy(), test_frame
    final_test = add_baselines(final_train, final_test); final_test["residual"] = final_test.actual - final_test.predicted
    headline = {}
    for name in ("RMSE", "MAE", "MAPE_percent", "R2"):
        values = np.array([row[name] for row in folds], dtype=float); headline[name] = {"mean": finite(values.mean()), "std": finite(values.std(ddof=1)), "fold_values": [finite(value) for value in values]}
    bootstrap = {name: bootstrap_ci(final_test.actual.to_numpy(), final_test.predicted.to_numpy(), name) for name in ("RMSE", "MAE", "R2")}
    baselines = {name: improvement_ci(final_test.actual.to_numpy(), final_test.predicted.to_numpy(), final_test[name].to_numpy()) for name in ("naive_1", "seasonal_7", "historical_day_of_week_mean")}
    final_model = clone(model_template); final_model.fit(X.iloc[final_train.index], y[final_train.index]); permutation = permutation_importance(final_model, X.loc[final_test.index, feature_columns], y[final_test.index], n_repeats=20, random_state=SEED, scoring="neg_root_mean_squared_error"); importance = pd.Series(permutation.importances_mean, index=feature_columns)
    save_plots(final_test, folds, importance, learning_curve)
    n_test, degrees = len(final_test), len(final_test) - 1; supports_r2 = n_test >= max(30, 10 * len(feature_columns))
    results = {"data": {"frequency": "daily", "source": "reconstructed from monthly totals using daily_profile.json", "rows": len(daily), "date_start": daily.date.min().date().isoformat(), "date_end": daily.date.max().date().isoformat(), "seed": SEED}, "model": {"path": str(MODEL_PATH), "feature_columns": feature_columns}, "cross_validation": {"method": "TimeSeriesSplit", "n_splits": 5, "folds": folds, "headline_mean_plus_minus_std": headline}, "final_test_fold": {"n": n_test, "date_start": final_test.date.min().date().isoformat(), "date_end": final_test.date.max().date().isoformat(), "metrics": metric_values(final_test.actual, final_test.predicted), "bootstrap_95_percent_CI": bootstrap, "baseline_RMSE_improvement_percent_CI": baselines, "residual_diagnostics": diagnostics(final_test)}, "statistical_power": {"n_test": n_test, "degrees_of_freedom": degrees, "predictor_count": len(feature_columns), "supports_claimed_R2": supports_r2, "interpretation": "Supports a descriptive out-of-sample R2 estimate under the reconstructed daily-data assumption." if supports_r2 else "Insufficient test size for a stable R2 claim with this predictor count."}, "feature_importance": importance.sort_values(ascending=False).to_dict(), "limitations": ["No measured daily historical CSV exists in the repository; daily targets are reconstructed from monthly totals and assumed profile shares.", "The reconstructed daily rows are not independent observations, so confidence intervals should not be interpreted as equivalent to intervals from measured daily data."]}
    EVALUATION_DIR.mkdir(parents=True, exist_ok=True)
    with (EVALUATION_DIR / "metrics.json").open("w", encoding="utf-8") as handle: json.dump(results, handle, indent=2, allow_nan=False)
    final_test[["date", "actual", "predicted", "residual"]].to_csv(EVALUATION_DIR / "predictions.csv", index=False)
    write_summary(results)
    print(f"Daily evaluation: {len(daily)} rows, final test fold n={n_test}")
    print(f"RMSE={headline['RMSE']['mean']:.4f} +/- {headline['RMSE']['std']:.4f}; R2={headline['R2']['mean']:.4f} +/- {headline['R2']['std']:.4f}")
    print(f"Outputs: {EVALUATION_DIR}")
    return results


def publication(value, spread=None, interval=None):
    if value is None: return "NA"
    text = f"{value:.2f} ± {spread:.2f}" if spread is not None else f"{value:.2f}"
    if interval: text += f" (95% CI: {interval['lower']:.2f}–{interval['upper']:.2f})"
    return text


def write_summary(results):
    headline, final, power = results["cross_validation"]["headline_mean_plus_minus_std"], results["final_test_fold"], results["statistical_power"]
    lines = ["# Daily Model Evaluation Summary", "", "## Five-Fold Expanding-Window Cross-Validation", "", "| Metric | Mean ± SD across folds |", "|---|---:|"]
    for name in ("RMSE", "MAE", "MAPE_percent", "R2"): lines.append(f"| {name} | {publication(headline[name]['mean'], headline[name]['std'])} |")
    lines += ["", "## Fold Results", "", "| Fold | Train n | Test n | RMSE | MAE | MAPE (%) | R2 |", "|---:|---:|---:|---:|---:|---:|---:|"]
    for fold in results["cross_validation"]["folds"]: lines.append(f"| {fold['fold']} | {fold['train_n']} | {fold['test_n']} | {fold['RMSE']:.2f} | {fold['MAE']:.2f} | {fold['MAPE_percent']:.2f} | {fold['R2']:.3f} |")
    lines += ["", "## Final Test Fold", "", f"n = {final['n']}; period = {final['date_start']} to {final['date_end']}", "", "| Metric | Estimate with 95% bootstrap CI |", "|---|---:|"]
    for name in ("RMSE", "MAE", "R2"): lines.append(f"| {name} | {publication(final['bootstrap_95_percent_CI'][name]['estimate'], interval=final['bootstrap_95_percent_CI'][name])} |")
    lines += ["", "## Baseline RMSE Improvement", "", "| Baseline | Model improvement with 95% CI (%) |", "|---|---:|"]
    for name, interval in final["baseline_RMSE_improvement_percent_CI"].items(): lines.append(f"| {name} | {interval['estimate_percent']:.2f}% (95% CI: {interval['lower_percent']:.2f}–{interval['upper_percent']:.2f}) |")
    support = "supports" if power["supports_claimed_R2"] else "does not support"
    lines += ["", "## Statistical Power", "", f"The final test fold contains **{power['n_test']}** observations with **{power['degrees_of_freedom']}** degrees of freedom and {power['predictor_count']} predictors. Under the stated heuristic, the sample size **{support}** the claimed R2 as a descriptive out-of-sample estimate. This conclusion is conditional on the reconstructed daily targets and should be reassessed using measured daily observations.", "", "## Interpretation", "", "Headline values are mean +/- standard deviation across five chronological expanding-window folds. Bootstrap intervals use 1,000 paired resamples of the final test fold with seed 42. Daily rows are reconstructed from monthly totals using assumed daily profile shares; they increase temporal resolution but do not represent independent measured daily samples."]
    (EVALUATION_DIR / "metrics_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    evaluate()
