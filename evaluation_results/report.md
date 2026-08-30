# VisionWaste model evaluation report

Generated: 2026-08-30 07:46:28 UTC

## Summary metrics (for conference paper)

| Model | Metric | Value | Split | Class | Notes |
|---|---|---:|---|---|---|
| waste_mobilenetv2 | test_images | 372 | test | |  |
| waste_mobilenetv2 | accuracy | 97.58 | test | | percent |
| waste_mobilenetv2 | precision_organic | 0.9721 | test | |  |
| waste_mobilenetv2 | recall_organic | 0.9775 | test | |  |
| waste_mobilenetv2 | f1_organic | 0.9748 | test | |  |
| animal_yolov8 | mAP50 | 0.8806 | test | |  |
| animal_yolov8 | mAP50-95 | 0.6101 | test | |  |
| animal_yolov8 | precision | 0.8641 | test | |  |
| animal_yolov8 | recall | 0.7959 | test | |  |
| bin_fill_yolov8 | mAP50 | 0.5919 | val | | From best.pt checkpoint (training-time validation, not a fresh test run). Original train data: C:\Users\Charuka\Desktop\garbage-project\dataset\data.yaml |
| bin_fill_yolov8 | mAP50-95 | 0.3650 | val | | From best.pt checkpoint (training-time validation, not a fresh test run). Original train data: C:\Users\Charuka\Desktop\garbage-project\dataset\data.yaml |
| bin_fill_yolov8 | precision | 0.5275 | val | | From best.pt checkpoint (training-time validation, not a fresh test run). Original train data: C:\Users\Charuka\Desktop\garbage-project\dataset\data.yaml |
| bin_fill_yolov8 | recall | 0.6183 | val | | From best.pt checkpoint (training-time validation, not a fresh test run). Original train data: C:\Users\Charuka\Desktop\garbage-project\dataset\data.yaml |
| bin_fill_yolov8 | best_epoch | 6 | val | | From best.pt checkpoint (training-time validation, not a fresh test run). Original train data: C:\Users\Charuka\Desktop\garbage-project\dataset\data.yaml |
| bin_fill_yolov8 | class | Empty | val | | class list from checkpoint (per-class mAP needs dataset re-val) |
| bin_fill_yolov8 | class | Half | val | | class list from checkpoint (per-class mAP needs dataset re-val) |
| bin_fill_yolov8 | class | Overflow | val | | class list from checkpoint (per-class mAP needs dataset re-val) |
| risk_engine_rules | scenario_accuracy | 100.00 | test | | 6/6 scenarios; percent |
| risk_engine_rules | scenarios_total | 6 | test | |  |
| risk_engine_rules | scenarios_passed | 6 | test | |  |

## Per-class metrics

- **waste_mobilenetv2** / non_organic: precision = 0.9793 (test)
- **waste_mobilenetv2** / non_organic: recall = 0.9742 (test)
- **waste_mobilenetv2** / non_organic: f1 = 0.9767 (test)
- **waste_mobilenetv2** / organic: precision = 0.9721 (test)
- **waste_mobilenetv2** / organic: recall = 0.9775 (test)
- **waste_mobilenetv2** / organic: f1 = 0.9748 (test)
- **animal_yolov8** / cat: mAP50-95 = 0.6183 (test)
- **animal_yolov8** / crow: mAP50-95 = 0.6279 (test)
- **animal_yolov8** / dog: mAP50-95 = 0.6630 (test)
- **animal_yolov8** / monkey: mAP50-95 = 0.5311 (test)

## Dataset sizes

| Model | Split | Class | Images |
|---|---|---|---:|
| waste_mobilenetv2 | train | non_organic | 912 |
| waste_mobilenetv2 | train | organic | 831 |
| waste_mobilenetv2 | val | non_organic | 195 |
| waste_mobilenetv2 | val | organic | 178 |
| waste_mobilenetv2 | test | non_organic | 194 |
| waste_mobilenetv2 | test | organic | 178 |
| animal_yolov8 | train | (all) | 2721 |
| animal_yolov8 | valid | (all) | 260 |
| animal_yolov8 | test | (all) | 130 |

## Skipped

- **litter_yolov8**: Model not found: C:\Users\ranaw\Documents\Research_Project\R26-IT-084\services\litter-severity-api\model\best.pt

## Artifacts

- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\waste_confusion_matrix.csv`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\waste_confusion_matrix.png`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\waste_per_class.csv`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\animal_yolov8_per_class.csv`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\yolo_runs\animal_yolov8\confusion_matrix.png`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\yolo_runs\animal_yolov8\confusion_matrix_normalized.png`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\bin_fill_yolov8_checkpoint_metrics.csv`
- `C:\Users\ranaw\Documents\Research_Project\R26-IT-084\evaluation_results\risk_engine_scenarios.csv`
