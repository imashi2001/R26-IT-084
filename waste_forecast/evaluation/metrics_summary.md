# Daily Model Evaluation Summary

## Five-Fold Expanding-Window Cross-Validation

| Metric | Mean ± SD across folds |
|---|---:|
| RMSE | 0.05 ± 0.02 |
| MAE | 0.03 ± 0.02 |
| MAPE_percent | 3.62 ± 1.98 |
| R2 | 0.95 ± 0.06 |

## Fold Results

| Fold | Train n | Test n | RMSE | MAE | MAPE (%) | R2 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 182 | 180 | 0.08 | 0.06 | 6.02 | 0.844 |
| 2 | 362 | 180 | 0.06 | 0.05 | 5.47 | 0.956 |
| 3 | 542 | 180 | 0.04 | 0.02 | 2.70 | 0.977 |
| 4 | 722 | 180 | 0.03 | 0.02 | 2.12 | 0.990 |
| 5 | 902 | 180 | 0.02 | 0.02 | 1.76 | 0.991 |

## Final Test Fold

n = 180; period = 2025-07-05 to 2025-12-31

| Metric | Estimate with 95% bootstrap CI |
|---|---:|
| RMSE | 0.02 (95% CI: 0.02–0.03) |
| MAE | 0.02 (95% CI: 0.02–0.02) |
| R2 | 0.99 (95% CI: 0.99–0.99) |

## Baseline RMSE Improvement

| Baseline | Model improvement with 95% CI (%) |
|---|---:|
| naive_1 | 91.11% (95% CI: 89.03–92.74) |
| seasonal_7 | 91.64% (95% CI: 89.57–93.13) |
| historical_day_of_week_mean | 87.84% (95% CI: 84.27–90.32) |

## Statistical Power

The final test fold contains **180** observations with **179** degrees of freedom and 17 predictors. Under the stated heuristic, the sample size **supports** the claimed R2 as a descriptive out-of-sample estimate. This conclusion is conditional on the reconstructed daily targets and should be reassessed using measured daily observations.

## Interpretation

Headline values are mean +/- standard deviation across five chronological expanding-window folds. Bootstrap intervals use 1,000 paired resamples of the final test fold with seed 42. Daily rows are reconstructed from monthly totals using assumed daily profile shares; they increase temporal resolution but do not represent independent measured daily samples.
