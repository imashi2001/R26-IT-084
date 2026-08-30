# Bin fill level model — Colab training evaluation

**Source:** Google Colab run `garbage_fill_level_detection_v1`  
**Model:** YOLOv8n (`yolov8n.pt`)  
**Classes:** Empty, Half, Overflow  
**Training:** 50 epochs on NVIDIA Tesla T4 GPU (~0.138 h)  
**Weights:** `Fill_level_training/garbage_fill_level_detection_v1/weights/best.pt`

## Overall validation metrics (use in conference paper)

| Metric | Value |
|--------|------:|
| Precision | **0.84** |
| Recall | **0.781** |
| mAP@0.5 | **0.861** |
| mAP@0.5:0.95 | **0.611** |

Validation set: **23 images**, **29 instances**

## Per-class validation metrics

| Class | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|-------|----------:|-------:|--------:|-------------:|
| Empty | 0.85 | 0.814 | 0.794 | 0.574 |
| Half | 0.778 | 1.0 | 0.995 | 0.691 |
| Overflow | 0.894 | 0.529 | 0.794 | 0.569 |

## Inference speed (per image)

| Stage | Time |
|-------|-----:|
| Preprocess | 0.2 ms |
| Inference | 2.0 ms |
| Postprocess | 0.7 ms |

## Figures for paper

- Training curves: `results.png` from Colab run folder
- Confusion matrix / PR curves: same Colab output folder (if generated)

## Note vs local `evaluate_all.py` report

The older `model-yolo/model/best.pt` in this repo embedded weaker metrics (mAP@0.5 ≈ 0.59, epoch 6, CPU training). **Use these Colab numbers** for the paper if this is the model you trained.

**Recommended:** copy Colab `best.pt` → `model-yolo/model/best.pt` so the deployed service matches reported results.
