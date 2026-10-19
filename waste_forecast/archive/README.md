# waste_forecast/archive

The live model is `waste_forecast/models/trend_model.json`, a weighted OLS trend with unweighted calendar-month effects, fitted by `waste_forecast/src/fit_production_model.py`. Nothing in this archive is loaded at runtime.

## trained_model.pkl
- **What:** legacy `XGBRegressor` (learning_rate 0.1, max_depth 6, n_estimators 150), formerly `forecasting dashboard/trained_model.pkl`.
- **Trained by:** training script missing from repository. It was trained on 24 features (listed in `model_features.pkl`), including `Rainfall_mm` and `Max_Temp_C`, which the current pipeline does not produce. **It cannot be regenerated.**
- **Referenced by:** `forecasting dashboard/analyze_model_feature_effects.py` (partial-dependence analysis only).
- **Why kept:** the only copy of the original estimator; needed to reproduce the feature-effect analysis.

## model_features.pkl
- **What:** a Python list of the 24 column names `trained_model.pkl` expects. Not a model.
- **Trained by:** written alongside `trained_model.pkl`; that script is missing from the repository.
- **Referenced by:** `forecasting dashboard/analyze_model_feature_effects.py`.
- **Why kept:** `trained_model.pkl` cannot be used without it.

## model.json.synthetic-era
- **What:** the original monthly XGBoost model (17 features, see `feature_columns.json`), formerly `waste_forecast/models/model.json`.
- **Trained by:** initial training script not in the repository. Later candidates came from the XGBoost version of `retrain_pipeline.py` (in git history).
- **Referenced by:** nothing in code. Older docs (`API_CONTRACT.md`, `TECH_STACK.md`, `FORECASTING_AUDIT.md`) still describe it as live; they predate the trend model.
- **Why kept:** dissertation before-state evidence. Its `base_score` is 29.67, showing it was trained on the deprecated ~29 t/month synthetic series (`DEFAULT_MONTHLY_WASTE` in `load_data.py`), not on the real 8,080-14,137 t/month WPWMA data (2023-2025). **It is evidence, not a usable model.**

## model_candidate.json
- **What:** byte-identical copy of `model.json.synthetic-era`; the last candidate written by the XGBoost retrain pipeline.
- **Trained by:** XGBoost version of `retrain_pipeline.py` (git history).
- **Referenced by:** nothing in code.
- **Why kept:** record of the retired retrain loop's final state.

## feature_columns.json
- **What:** the 17 monthly feature names of the retired XGBoost model (`lag_1..3`, rolling stats, calendar counts, `month_sin/cos`, `quarter`).
- **Trained by:** written by the XGBoost version of `retrain_pipeline.py`; features built by `waste_forecast/src/features.py`.
- **Referenced by:** nothing in code.
- **Why kept:** documents the input contract of `model.json.synthetic-era`.

## trained_model_daily.pkl
- **What:** `{"model": HistGradientBoostingRegressor, "feature_columns": [17 daily features], "seed": 42}`.
- **Trained by:** `waste_forecast/src/train_daily_model.py`, on daily targets reconstructed from monthly totals × `daily_profile.json` shares. That script now writes here.
- **Referenced by:** `waste_forecast/src/evaluate_model.py`; recorded in `waste_forecast/evaluation/metrics.synthetic-era-void.json`.
- **Why kept:** it produced the old daily metrics. Untracked in git, so this is the only copy.

## trend_model.20261018T205554.json
- **What:** pre-promotion backup of `trend_model.json` from a retrain on 2026-10-18; byte-identical to the current live model.
- **Trained by:** `waste_forecast/src/fit_production_model.py` / `retrain_pipeline.py`.
- **Referenced by:** nothing. `retrain_pipeline.py` writes future backups here as `trend_model.<timestamp>.json`.
- **Why kept:** rollback point for the live model.
