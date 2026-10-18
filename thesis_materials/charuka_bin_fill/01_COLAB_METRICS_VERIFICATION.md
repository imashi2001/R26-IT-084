# Verification: Reported Results vs Original Colab Evaluation

**Project:** R26-IT-084 — VisionWaste (Bin Fill / IoT / Mobile)  
**Verified against:** `evaluation_results/bin_fill_colab_report.md`  
**Training log:** `garbage_fill_level_detection_v1/results.csv`  
**Date of verification:** 2026-10-10  

---

## 1. Verdict

| Check | Status |
|-------|--------|
| Colab overall metrics match training log | **PASS** |
| Matching epoch identified | **Epoch 32** (best Ultralytics fitness proxy) |
| Per-class table present in Colab report | **PASS** (source of truth for paper) |
| Confusion matrix available from same run | **PASS** (validation set) |
| Fresh held-out **test** re-evaluation | **PENDING** — requires Roboflow dataset download (see `02_TEST_SET_EVALUATION.md`) |

**Recommendation for thesis:** Cite Colab / epoch-32 validation metrics as the primary detector result. Clearly label confusion matrices as **validation-split** until test-set evaluation is completed.

---

## 2. Primary numbers (use in thesis)

From `bin_fill_colab_report.md` (Google Colab run `garbage_fill_level_detection_v1`, YOLOv8n, 50 epochs, Tesla T4):

| Metric | Colab report | `results.csv` epoch 32 | Abs. difference | Match? |
|--------|-------------:|-----------------------:|----------------:|:------:|
| Precision | 0.840 | 0.84226 | 0.002 | Yes |
| Recall | 0.781 | 0.77836 | 0.003 | Yes |
| mAP@0.5 | 0.861 | 0.86093 | &lt;0.001 | Yes |
| mAP@0.5:0.95 | 0.611 | 0.6114 | &lt;0.001 | Yes |

Rounding in the Colab report explains sub-0.01 differences. **Epoch 32** is also the epoch that maximises the common YOLO fitness proxy  
`0.1 × mAP@0.5 + 0.9 × mAP@0.5:0.95`, which is how Ultralytics typically selects `best.pt`.

---

## 3. Per-class metrics (Colab report — cite as-is)

| Class | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|-------|----------:|-------:|--------:|-------------:|
| Empty | 0.850 | 0.814 | 0.794 | 0.574 |
| Half | 0.778 | 1.000 | 0.995 | 0.691 |
| Overflow | 0.894 | 0.529 | 0.794 | 0.569 |

Derived F1 (not in Colab file; safe to report as computed):

| Class | F1 |
|-------|---:|
| Overall | 0.809 |
| Empty | 0.832 |
| Half | 0.875 |
| Overflow | 0.665 |

Validation set size (Colab): **23 images**, **29 instances**.

---

## 4. Inference speed (Colab report)

| Stage | Time |
|-------|-----:|
| Preprocess | 0.2 ms |
| Inference | 2.0 ms |
| Postprocess | 0.7 ms |

These are **model-only** times, not ESP32→cloud end-to-end latency.

---

## 5. What must NOT be mixed into the paper as “your” result

Older local checkpoint evaluation (`evaluation_results/bin_fill_yolov8_checkpoint_metrics.csv` / `report.md`):

| Metric | Weak checkpoint |
|--------|----------------:|
| mAP@0.5 | 0.5919 |
| mAP@0.5:0.95 | 0.3650 |
| Precision | 0.5275 |
| Recall | 0.6183 |
| Notes | Early epoch ~6; not Colab `best.pt` |

**Thesis wording:** mention only as a train–deploy alignment lesson, not as detector accuracy.

---

## 6. Figures already verified from the Colab run folder

Copied to `thesis_materials/figures/`:

| File | Use in thesis |
|------|----------------|
| `confusion_matrix.png` | Validation confusion matrix |
| `confusion_matrix_normalized.png` | Normalised confusion matrix |
| `results.png` | Training curves |
| `BoxPR_curve.png` | Precision–Recall |
| `BoxF1_curve.png` | F1 curve |
| `val_batch0_labels.jpg` / `val_batch0_pred.jpg` | Qualitative samples |

---

## 7. Suggested thesis sentence (verified)

> The YOLOv8n bin-fill detector trained for 50 epochs on NVIDIA Tesla T4 achieved validation precision 0.84, recall 0.781, mAP@0.5 of 0.861 and mAP@0.5:0.95 of 0.611. These values match epoch 32 of the training log (`results.csv`), corresponding to the best-fitness checkpoint used as `best.pt`.
