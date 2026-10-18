# Thesis Materials — Charuka (Bin Fill + IoT + Mobile)

Everything you need to finish the experimental / documentation requirements for your contribution.

## Status dashboard

| Requirement | Status | Where |
|-------------|--------|--------|
| Verify Colab metrics | **DONE — PASS** | `charuka_bin_fill/01_COLAB_METRICS_VERIFICATION.md` |
| Confusion matrix (validation) | **DONE** | `figures/confusion_matrix.png` (+ normalised) |
| Held-out **test** eval + CM | **Script ready — you must download dataset & run** | `charuka_bin_fill/02_TEST_SET_EVALUATION.md`, `scripts/eval_bin_fill_test.py` |
| E2E latency ESP32→backend→Flutter | **Protocol + probe script ready — you must measure on hardware** | `latency/LATENCY_PROTOCOL.md`, `scripts/probe_predict_latency.py` |
| Architecture / wiring / sequence diagrams | **DONE (Mermaid)** | `diagrams/` |
| Screenshot checklist | **DONE** | `charuka_bin_fill/03_SCREENSHOTS_CHECKLIST.md` |
| SLIIT cover page | **Template — fill your details** | `charuka_bin_fill/04_COVER_PAGE_SLIIT.md` |
| IEEE references | **DONE** | `charuka_bin_fill/05_REFERENCES_IEEE.md` |

## Verified detector numbers (cite these)

| Metric | Value |
|--------|------:|
| Precision | **0.84** |
| Recall | **0.781** |
| mAP@0.5 | **0.861** |
| mAP@0.5:0.95 | **0.611** |

Matched to training log **epoch 32** in `garbage_fill_level_detection_v1/results.csv`.

## What you still must do yourself

1. **Download** Roboflow Garbage_Fill_Level v2 into `dataset/` and run:
   ```powershell
   python scripts\eval_bin_fill_test.py --split test
   ```
2. **Run latency trials** with ESP32 + Flutter using `latency/LATENCY_PROTOCOL.md` (n≥30).  
3. **Export Mermaid diagrams** to PNG via https://mermaid.live  
4. **Capture screenshots** from checklist.  
5. **Fill cover page** student IDs / supervisor / degree name.  

## Folder map

```
thesis_materials/
  README.md                          ← this file
  charuka_bin_fill/                  ← verification, eval guide, cover, refs
  figures/                           ← Colab curves + confusion matrices
  diagrams/                          ← architecture, sequences, wiring
  latency/                           ← protocol + CSV template
```
