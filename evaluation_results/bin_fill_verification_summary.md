# Bin-fill metrics verification summary

**Status:** Colab report **verified** against `garbage_fill_level_detection_v1/results.csv` (epoch 32).

| Metric | Colab report | results.csv epoch 32 |
|--------|-------------:|---------------------:|
| Precision | 0.84 | 0.84226 |
| Recall | 0.781 | 0.77836 |
| mAP@0.5 | 0.861 | 0.86093 |
| mAP@0.5:0.95 | 0.611 | 0.6114 |

Validation confusion matrices from the same training run:

- `evaluation_results/bin_fill_figures/confusion_matrix.png`
- `evaluation_results/bin_fill_figures/confusion_matrix_normalized.png`

Full write-up: `thesis_materials/charuka_bin_fill/01_COLAB_METRICS_VERIFICATION.md`

Held-out test evaluation: run `python scripts/eval_bin_fill_test.py` after downloading the Roboflow dataset.
