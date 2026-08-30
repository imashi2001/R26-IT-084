Garbage_Fill_Level - v2 2026-05-01 7:24pm
==============================

This dataset was exported via roboflow.com on May 5, 2026 at 8:51 AM GMT

The dataset includes 622 images.
Garbage-Fill-Level are annotated in YOLOv8 format.

Classes: Empty, Half, Overflow

To restore locally for evaluation:
1. Open https://universe.roboflow.com/charuka-edirisinghe/garbage_fill_level/dataset/2
2. Download in YOLOv8 format
3. Extract so you have dataset/train, dataset/valid, dataset/test
4. Run: python evaluate_all.py --model bin

Or with Roboflow API key:
  set ROBOFLOW_API_KEY=your_key
  python evaluate_all.py --model bin --download-bin-dataset
