# Monthly Forecasting Evaluation

## Data Availability Statement

This study uses monthly aggregated waste totals (n=33 months, Jan 2023–Sep 2025) as daily-resolution measurements are not routinely recorded at Sri Lankan municipal waste facilities. Monthly forecasting reflects the operational data availability.

## Cross-Validation

Past-only expanding-origin leave-one-out evaluation is used. Jan 2023 is not evaluable because no earlier training month exists.

| Metric | Mean ± SD across evaluable folds | Aggregate OOF 95% CI |
|---|---:|---:|
| RMSE | 0.882 ± 1.146 | 0.824–1.938 |
| MAE | 0.882 ± 1.146 | 0.536–1.298 |
| MAPE_percent | 2.864 ± 3.503 | 1.798–4.151 |
| R2 | 0.182 (aggregate OOF) | -0.233–0.485 |

## Fold Results

| Fold | Training months | Test month | RMSE | MAE | MAPE (%) | R² |
|---:|---:|---|---:|---:|---:|---:|
| 1 | 1 | 2023-02-28 | 1.300 | 1.300 | 4.78 | NA |
| 2 | 2 | 2023-03-31 | 1.250 | 1.250 | 4.30 | NA |
| 3 | 3 | 2023-04-30 | 3.133 | 3.133 | 9.98 | NA |
| 4 | 4 | 2023-05-31 | 0.150 | 0.150 | 0.52 | NA |
| 5 | 5 | 2023-06-30 | 1.220 | 1.220 | 4.39 | NA |
| 6 | 6 | 2023-07-31 | 0.517 | 0.517 | 1.83 | NA |
| 7 | 7 | 2023-08-31 | 0.257 | 0.257 | 0.89 | NA |
| 8 | 8 | 2023-09-30 | 0.675 | 0.675 | 2.40 | NA |
| 9 | 9 | 2023-10-31 | 0.100 | 0.100 | 0.35 | NA |
| 10 | 10 | 2023-11-30 | 0.790 | 0.790 | 2.83 | NA |
| 11 | 11 | 2023-12-31 | 4.582 | 4.582 | 13.80 | NA |
| 12 | 12 | 2024-01-31 | 0.000 | 0.000 | 0.00 | NA |
| 13 | 13 | 2024-02-29 | 1.200 | 1.200 | 4.32 | NA |
| 14 | 14 | 2024-03-31 | 0.586 | 0.586 | 1.99 | NA |
| 15 | 15 | 2024-04-30 | 3.147 | 3.147 | 9.80 | NA |
| 16 | 16 | 2024-05-31 | 0.150 | 0.150 | 0.51 | NA |
| 17 | 17 | 2024-06-30 | 0.759 | 0.759 | 2.67 | NA |
| 18 | 18 | 2024-07-31 | 0.217 | 0.217 | 0.75 | NA |
| 19 | 19 | 2024-08-31 | 0.495 | 0.495 | 1.67 | NA |
| 20 | 20 | 2024-09-30 | 0.030 | 0.030 | 0.10 | NA |
| 21 | 21 | 2024-10-31 | 0.307 | 0.307 | 1.06 | NA |
| 22 | 22 | 2024-11-30 | 0.339 | 0.339 | 1.19 | NA |
| 23 | 23 | 2024-12-31 | 3.135 | 3.135 | 9.22 | NA |
| 24 | 24 | 2025-01-31 | 0.024 | 0.024 | 0.08 | NA |
| 25 | 25 | 2025-02-28 | 0.011 | 0.011 | 0.04 | NA |
| 26 | 26 | 2025-03-31 | 0.621 | 0.621 | 2.07 | NA |
| 27 | 27 | 2025-04-30 | 2.314 | 2.314 | 7.06 | NA |
| 28 | 28 | 2025-05-31 | 0.371 | 0.371 | 1.24 | NA |
| 29 | 29 | 2025-06-30 | 0.035 | 0.035 | 0.12 | NA |
| 30 | 30 | 2025-07-31 | 0.209 | 0.209 | 0.71 | NA |
| 31 | 31 | 2025-08-31 | 0.270 | 0.270 | 0.90 | NA |
| 32 | 32 | 2025-09-30 | 0.030 | 0.030 | 0.10 | NA |

## Baseline Comparison

| Baseline | RMSE | R² | Model improvement (95% CI) |
|---|---:|---:|---:|
| naive | 2.258 | -1.034 | 36.59% (19.13–55.69) |
| seasonal_naive | 0.553 | 0.863 | -111.12% (-185.18–6.90) |
| moving_average_3 | 1.946 | -0.511 | 26.43% (14.44–41.21) |

The model is compared directly with each baseline. Improvements below 15% are reported as modest rather than presented as practically meaningful.

## Interpretation

All metrics use measured monthly totals. Bootstrap confidence intervals use 500 resamples with seed 42. Results should be interpreted cautiously because only 33 monthly observations are available.
