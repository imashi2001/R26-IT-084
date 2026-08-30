# Litter Severity Detection (YOLO11s + LSI)

Vision-based **litter outside the bin** monitoring for research: detect litter instances, quantify **count**, **area coverage**, and **spatial spread**, then fuse them into a **Litter Severity Index (LSI)** from **0–100** with **LOW / MEDIUM / HIGH** labels.

## Folder layout

```text
litter_severity_detection/
├── config/
│   └── lsi_config.yaml       # LSI weights, severity thresholds, conf/iou, optional bin polygon
├── dataset/
│   ├── data.yaml             # Ultralytics dataset definition (paths relative to this folder)
│   ├── train/images|labels/  # Populate from Roboflow YOLO export
│   ├── valid/images|labels/
│   ├── test/images|labels/
│   └── README_DATASET.txt
├── models/
│   └── best.pt               # Produced by train.py (copied from runs/.../weights/best.pt)
├── results/                  # Local detect.py outputs — gitignored except .gitkeep
├── runs/                     # Ultralytics training — gitignored (global runs/)
├── scripts/
│   ├── calculate_lsi.py      # Pure LSI math + optional in-bin polygon filter
│   ├── train.py              # Fine-tune yolo11s.pt
│   └── detect.py             # Inference, OpenCV draw, matplotlib optional, save to results/
├── notebooks/
│   └── Litter_Severity_YOLO11_Colab.ipynb
├── requirements.txt
└── README.md
```

## VisionWaste integration (production UI + API)

The **browser UI** and **Express proxy** for litter severity live in the main app:

- **Frontend:** `frontend/src/pages/LitterSeverityPage.js`, route **`/litter-severity`** (dashboard sidebar).
- **Backend:** `POST /litter-severity` (multipart `image`) in `backend/routes/litter.routes.js` → `MODEL_LITTER_URL` microservice.
- **Docker / Railway:** `services/litter-severity-api/` — see **`DOCKER.md`** in this folder for Compose commands (correct paths + Docker Desktop).

Keep `config/lsi_config.yaml` here in sync with `services/litter-severity-api/lsi_config.yaml` when you change LSI tuning (or maintain one source and copy before deploy).

## What to commit for hosting / merge (recommended scope)

| Area | Paths |
|------|--------|
| **Microservice (Railway Docker)** | `services/litter-severity-api/` (`Dockerfile`, `app.py`, `requirements.txt`, `calculate_lsi.py`, `lsi_config.yaml`, `model/best.pt` when you ship weights) |
| **Compose** | `docker-compose.litter.yml` (repo root), `litter_severity_detection/docker-compose.yml`, `litter_severity_detection/DOCKER.md` |
| **Main backend** | `backend/config/env.js`, `backend/services/modelClient.js`, `backend/controllers/litter.controller.js`, `backend/routes/litter.routes.js`, `backend/routes/index.js`, `backend/.env.example` |
| **Main frontend** | `frontend/src/pages/LitterSeverityPage.js`, `frontend/src/App.js`, `frontend/src/utils/apiBase.js`, `frontend/src/components/dashboard/Sidebar.js` |
| **Docs** | `services/README.md`, root `.gitignore` |

Local-only (training / experiments): `litter_severity_detection/results/*`, `runs/`, dataset images, `.venv`, and the old standalone `litter_severity_backend` / `litter_severity_frontend` folders are **gitignored** or removed — do not commit generated artifacts.

## What each file does

| File | Purpose |
|------|---------|
| `config/lsi_config.yaml` | Tunable LSI weights, severity thresholds, inference `conf`/`iou`, optional `bin_polygon`. |
| `dataset/data.yaml` | Ultralytics dataset YAML. |
| `scripts/calculate_lsi.py` | LSI math + `LSIMetrics`; same module is copied into `services/litter-severity-api/`. |
| `scripts/train.py` | Train YOLO11s; writes `models/best.pt`. |
| `scripts/detect.py` | Local batch inference + `results/`. |
| `notebooks/...ipynb` | Colab training workflow. |
| `requirements.txt` | Dependencies for training and `detect.py`. |

## LSI formula (default)

\[
\text{LSI} = 0.5 \cdot S_{\text{count}} + 0.3 \cdot S_{\text{area}} + 0.2 \cdot S_{\text{spread}}
\]

- **Count score**: linear ramp to 100 by `count_cap` detections (after optional bin mask).
- **Area score**: \(\min(100, \frac{\sum \text{bbox areas}}{\text{image area}} \times \text{area\_scale})\).
- **Spread score**: mean **pairwise** distance between bbox **centroids**, normalized by image diagonal × `spread_denominator`.

**Severity:** bands are defined in `config/lsi_config.yaml` (defaults tuned for LOW / MEDIUM / HIGH).

## Outside-bin-only litter (research note)

1. **Annotation policy (strongest):** In Roboflow, label **only** litter **outside** the bin so the detector never learns in-bin clutter.
2. **Geometry filter (this repo):** Define `bin_polygon` in `lsi_config.yaml` (pixel coordinates). Any detection whose **centroid** lies **inside** the polygon is dropped before LSI.
3. **Future work:** joint **bin segmentation** or **two-stage** bin mask + litter detector.

## Setup (local)

```powershell
cd litter_severity_detection
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install **into the venv** (avoids “Defaulting to user installation” and `ModuleNotFoundError: ultralytics` when the Store Python / pip mix is wrong):

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Always prefer `python -m pip` after activating `.venv`, not plain `pip`, on Windows.

**`ModuleNotFoundError: ultralytics` with `(.venv)` in the prompt:** your shell may still be running a different `python` (Store app / global). Check and fix:

```powershell
Get-Command python
python -c "import sys; print(sys.executable)"
```

You should see `...\litter_severity_detection\.venv\Scripts\python.exe`. If not, call the venv explicitly (works even without activation):

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/train.py --data dataset/data.yaml --epochs 100 --batch 16 --imgsz 640
```

Copy your Roboflow export into `dataset/` so `train/images`, `valid/images`, and `data.yaml` paths match.

**Ultralytics path pitfall:** In `data.yaml`, avoid `path: .` — it is resolved from your **shell current directory**, not from the YAML file’s folder, which produces errors like `missing path ...\litter_severity_detection\valid\images`. Omit `path` (as in the template) or set an explicit absolute path to `dataset/`.

## Training commands

```powershell
cd litter_severity_detection
python scripts/train.py --data dataset/data.yaml --epochs 100 --batch 16 --imgsz 640
```

On **Windows**, if you see multiprocessing / dataloader errors, retry with fewer workers:

```powershell
python scripts/train.py --data dataset/data.yaml --epochs 100 --batch 16 --workers 0
```

**Ultralytics CLI (equivalent):**

```powershell
yolo task=detect mode=train model=yolo11s.pt data=dataset/data.yaml epochs=100 imgsz=640 batch=16 project=runs name=litter_yolo11s
```

Weights copy: `train.py` copies `runs/litter_yolo11s/weights/best.pt` → `models/best.pt`.

## Validation / metrics

```powershell
yolo task=detect mode=val model=models/best.pt data=dataset/data.yaml imgsz=640
```

Or in Python: `YOLO("models/best.pt").val(data="dataset/data.yaml")`.

## Inference commands

```powershell
cd litter_severity_detection
python scripts/detect.py --weights models/best.pt --source dataset/test/images --save
```

Single image + preview window (if your environment has a display):

```powershell
python scripts/detect.py --weights models/best.pt --source path/to/image.jpg --save --show
```

## Google Colab

Open `notebooks/Litter_Severity_YOLO11_Colab.ipynb`, set **Runtime → Change runtime type → GPU**, run cells top-to-bottom. Update Roboflow API fields or upload a zip of `dataset/`.

## Accuracy improvement tips (thesis-ready)

- **Data:** more diverse scenes (weather, angles, bin types); hard negatives (empty pavement, leaves, shadows).
- **Labels:** tight boxes; consistent “is this litter?” policy; **only outside-bin** litter if that is the research claim.
- **Augmentation:** Ultralytics defaults are strong; for tiny litter try longer training + slightly higher resolution (`imgsz` 736/832) if VRAM allows.
- **Thresholds:** tune `inference.conf` on a **validation** set to balance precision/recall before reporting LSI.
- **LSI calibration:** adjust `count_cap`, `area_scale`, and `spread_denominator` using a small **human-rated** validation set so LSI aligns with expert judgment.
- **Model:** if real-time on edge hardware matters, compare `yolo11n` vs `yolo11s`; for accuracy, try `yolo11m` when GPU budget allows.

## Research extensions (future work)

- **Temporal litter growth:** track LSI over time per camera ID; slope + persistence → escalation rules.
- **Warning sign recommendation:** map LSI + dwell time to suggested signage (e.g. HIGH + school zone).
- **Municipality alerts:** webhook/email when LSI crosses thresholds for N consecutive frames.
- **Hotspot detection:** aggregate GPS-tagged bins; cluster high-LSI spatio-temporal events.
- **ESP32-CAM deployment:** lightweight export (TensorRT, ONNX, or `yolo11n`) + bridge upload (see parent repo `VisionWaste/bridge`).
- **Real-time optimization:** batch inference, half precision, smaller input size, ROI crop around bin vicinity.

## License / ethics

Document dataset license (Roboflow export metadata) and limitations (single-class litter, occlusion, night performance) in your thesis.
