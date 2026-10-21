# Application Screenshots Checklist (Thesis Figures / Plates)

Capture at **1080p+**, crop UI chrome, add figure captions. Store originals under `thesis_materials/figures/screenshots/` (create folder; do not commit secrets).

## Web — Bin Level Detector

| # | Screen | How | Caption idea |
|---|--------|-----|----------------|
| W1 | `/bin-level-detector` empty | Logged-in dashboard | Bin Level Detector upload UI |
| W2 | After image upload | Show annotated fill tier | Example Empty/Half/Overflow prediction |
| W3 | Live monitoring map | Fill-coloured pins | Fleet fill status on map |

## Flutter — Public

| # | Screen | Route | Caption idea |
|---|--------|-------|----------------|
| P1 | Role picker | `/` | Public vs staff entry |
| P2 | Nearest bins map | `/public` | Citizen nearest-bin map with fill badges |
| P3 | Navigation preview | `/navigate` | In-app route to selected bin |

## Flutter — Staff

| # | Screen | Route | Caption idea |
|---|--------|-------|----------------|
| S1 | Login | `/staff/login` | Municipal staff authentication |
| S2 | Dashboard KPIs | `/staff/dashboard` | Empty/Half/Overflow counts |
| S3 | Bins list/map | `/staff/bins` | Staff bin inventory |
| S4 | Bin detail | `/staff/bins/:id` | Latest capture + fill + risk |
| S5 | Routes | `/staff/routes` | Collection plan Half+Overflow |
| S6 | Alerts | `/staff/alerts` | Operational alert feed |

## IoT evidence

| # | Capture | Caption idea |
|---|---------|----------------|
| I1 | Serial log PIR→upload→command | Firmware activity log |
| I2 | Hardware photo | ESP32-CAM + PIR + DFPlayer assembly |

## Already available training figures

Use from `thesis_materials/figures/`:

- `results.png`, `confusion_matrix*.png`, `BoxPR_curve.png`, `val_batch0_pred.jpg`
