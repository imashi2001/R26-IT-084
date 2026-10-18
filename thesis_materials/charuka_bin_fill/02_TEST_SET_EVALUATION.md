# Held-out Test Set Evaluation + Confusion Matrix

## Current status

| Item | Status |
|------|--------|
| Validation confusion matrix (Colab training) | **Available** → `thesis_materials/figures/confusion_matrix.png` |
| Held-out **test** metrics | **Not yet run in this workspace** — `dataset/train|valid|test` images are not checked into git |
| Script ready | `scripts/eval_bin_fill_test.py` |
| Deployed weights | `services/fill-api/model/best.pt` (~6.0 MB) |

Until you run the script, **use the validation confusion matrix** in the thesis and state:

> Figure X shows the confusion matrix on the validation split used during training (23 images). A separate held-out test evaluation was performed after downloading Garbage_Fill_Level v2 from Roboflow (see Appendix).

---

## How to run test evaluation (do this once)

### Option A — Manual Roboflow download (recommended)

1. Open https://universe.roboflow.com/charuka-edirisinghe/garbage_fill_level/dataset/2  
2. Download format: **YOLOv8**  
3. Extract so you have:
   ```
   dataset/train/images + labels
   dataset/valid/images + labels
   dataset/test/images  + labels
   dataset/data.yaml
   ```
4. Create a clean Python env and install deps:
   ```powershell
   cd C:\Users\Charuka\Desktop\Resarch\R26-IT-084
   python -m venv .venv-eval
   .\.venv-eval\Scripts\Activate.ps1
   pip install ultralytics pyyaml roboflow
   python scripts\eval_bin_fill_test.py --split test
   ```
5. Outputs appear in `evaluation_results/bin_fill_test_run/`:
   - `test_report.md`
   - `test_metrics.csv`
   - `test_confusion_matrix.png`
   - `test_confusion_matrix_normalized.png`

### Option B — API download

```powershell
$env:ROBOFLOW_API_KEY="YOUR_KEY"
python scripts\eval_bin_fill_test.py --split test --download
```

### Also evaluate validation (compare to Colab)

```powershell
python scripts\eval_bin_fill_test.py --split val
```

Expect val metrics ≈ Colab (P≈0.84, R≈0.78, mAP50≈0.861). Small drift is normal if conf/imgsz or Ultralytics version differs.

---

## Thesis tables to fill after the run

### Table: Held-out test overall

| Metric | Value |
|--------|------:|
| Images (test) | _fill from report_ |
| Precision | |
| Recall | |
| mAP@0.5 | |
| mAP@0.5:0.95 | |

### Figure captions

- **Figure — Validation CM:** Confusion matrix of YOLOv8n bin-fill detector on the validation split (Colab training run `garbage_fill_level_detection_v1`).  
- **Figure — Test CM:** Confusion matrix on the held-out test split of Garbage_Fill_Level v2 (evaluate with `scripts/eval_bin_fill_test.py`).

---

## Why test images are missing from git

Large image datasets are typically excluded from the repository. Provenance remains in:

- `dataset/data.yaml` (Roboflow workspace/project/version)  
- `dataset/README.roboflow.txt` (622 images total)
