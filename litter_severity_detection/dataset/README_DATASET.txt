Place your Roboflow YOLOv8 export here:

  litter_severity_detection/dataset/
    data.yaml          (this folder — update names/nc if needed)
    train/images/
    train/labels/
    valid/images/
    valid/labels/
    test/images/
    test/labels/

After unzipping Roboflow, merge contents into this folder and ensure data.yaml
paths match your folder names (some exports use "valid", others "val").

Outside-bin-only litter:
  Prefer labeling only litter outside the bin in Roboflow.
  Optionally use config/bin polygon in lsi_config.yaml to drop detections
  whose centroids fall inside the bin region (see README.md).
