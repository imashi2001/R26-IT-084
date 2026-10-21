# waste_forecast/archive

The live model is `waste_forecast/models/trend_model.json`, a weighted OLS trend with unweighted calendar-month effects, fitted by `waste_forecast/src/fit_production_model.py`. Nothing archived here is loaded at runtime.

## The archived artifacts were removed from the working tree

**They are all still in git at commit `bacf3a3b` (`bacf3a3ba9e206008e0b78eac3a11e3efa93658b`).** That commit holds every file listed below at its archive path; each was checked byte-for-byte against the working copy before removal.

Restore one file (from the repo root):

```
git restore --source=bacf3a3b -- waste_forecast/archive/trained_model.pkl
```

Restore everything:

```
git restore --source=bacf3a3b -- waste_forecast/archive
```

(On Git older than 2.23: `git checkout bacf3a3b -- <path>`.) The scripts in `scripts/` still run once restored to their archive paths.

`retrain_pipeline.py` writes the outgoing live model here as `trend_model.<timestamp>.json` whenever a retrain is promoted, so new rollback backups can appear in this folder.

## What was archived

| File (under `waste_forecast/archive/`) | What it is | Trained by / origin | Why it was kept |
|---|---|---|---|
| `trained_model.pkl` | Legacy `XGBRegressor` (learning_rate 0.1, max_depth 6, n_estimators 150), formerly `forecasting dashboard/trained_model.pkl` | **Training script missing from the repository.** It was trained on 24 features (in `model_features.pkl`), including `Rainfall_mm` and `Max_Temp_C`, which the current pipeline does not produce. **It cannot be regenerated.** | Only copy of the original estimator |
| `model_features.pkl` | List of the 24 column names `trained_model.pkl` expects; not a model | Written with `trained_model.pkl` (script missing) | Needed to use `trained_model.pkl` |
| `model.json.synthetic-era` | Original monthly XGBoost model (17 features), formerly `waste_forecast/models/model.json` | Initial script not in repository; later candidates from the XGBoost-era `retrain_pipeline.py` | **Evidence, not a usable model:** `base_score` 29.67 shows it was trained on the deprecated ~29 t/month synthetic series, not the real 8,080-14,137 t/month WPWMA data |
| `model_candidate.json` | Byte-identical copy of `model.json.synthetic-era`; last XGBoost retrain candidate | XGBoost-era `retrain_pipeline.py` | Final state of the retired retrain loop |
| `feature_columns.json` | 17 monthly feature names of the retired XGBoost model | XGBoost-era `retrain_pipeline.py` / `features.py` | Input contract of `model.json.synthetic-era` |
| `trained_model_daily.pkl` | `HistGradientBoostingRegressor` on 17 daily features | `scripts/train_daily_model.py`, on daily targets reconstructed from monthly totals | Produced the old (void) daily metrics |
| `trend_model.20261018T205554.json` | Retrain backup of `trend_model.json`, byte-identical to the live model at the time | `retrain_pipeline.py` | Rollback point |
| `scripts/train_daily_model.py` | Trains `trained_model_daily.pkl` | — | How the daily pickle was made |
| `scripts/evaluate_model.py` | Evaluates `trained_model_daily.pkl`; wrote `evaluation/metrics.synthetic-era-void.json` and `evaluation/plots/` | — | Source of those void metrics |
| `scripts/evaluate_monthly.py` | Evaluates the old monthly feature-table model; writes `evaluation/monthly/` | — | Source of those outputs |
| `scripts/monthly_dataset.py` | Builds the old monthly feature table for `evaluate_monthly.py` | — | Imported by `evaluate_monthly.py` |
| `scripts/analyze_model_feature_effects.py` | Partial-dependence plots for `trained_model.pkl` (rainfall, temperature) | — | Only tool that inspects the legacy model |
| `scripts/app.py` | Standalone Dash/Plotly prototype (geocoding, Calendarific holidays, random rule-based fill levels), formerly `forecasting dashboard/app.py`; never run by the live path | — | Prototype record. Its Calendarific fetch and cache write were extracted to `waste_forecast/src/refresh_holiday_cache.py` before it was archived |
