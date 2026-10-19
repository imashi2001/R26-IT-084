# Technology Stack & Implementation Specifications

This document outlines the technical specifications, software versions, architecture, and deployment details for **Chapter 5 (Implementation)** of the dissertation, specifically covering the **Event-Aware Waste Demand Forecasting** component in this repository (`R26-IT-084`).

---

## 1. Versions and Software Dependencies

### 1.1 Python Environment & Data Science Packages
* **Python Runtime:** Python 3.10+ (compatible with Python 3.10, 3.11, 3.12).
* **Package Specifications (Imported by `waste_forecast/src/*.py`, `run_model.py`, and `forecasting dashboard/`):**
  * `pandas`: Used across all feature pipelines (`calendar_features.py`, `daily_forecast.py`, `features.py`, `load_data.py`, `retrain_pipeline.py`).
  * `numpy`: Used for rolling mean/std calculation, cyclical sine/cosine transforms, and RMSE metrics.
  * `xgboost`: **Not used in the live forecast path.** Needed only to unpickle the archived legacy model (removed from the working tree; kept in git at `bacf3a3b`, see `waste_forecast/archive/README.md`). The live model is `waste_forecast/models/trend_model.json`, a weighted OLS trend with unweighted calendar-month effects (`trend_model.py`, fitted by `fit_production_model.py`).
  * `scikit-learn`: Used in `evaluate_model.py` and `evaluate_monthly.py` (`mean_squared_error`, `mean_absolute_error`, `r2_score`, `TimeSeriesSplit`, `permutation_importance`).
  * `scipy`: Used in `evaluate_model.py` and `compute_baselines.py` (`scipy.stats` for distributions and confidence intervals).
  * `matplotlib`: Used in `evaluate_model.py` and `evaluate_monthly.py` (with `"Agg"` backend for headless metric curve generation).
  * `dash` (>= 2.17), `plotly` (>= 5.20), `dash-bootstrap-components` (>= 1.6): Used only in the archived early research prototype (`app.py`; see `waste_forecast/archive/README.md`).
  * `requests` (>= 2.31), `geopy` (>= 2.4): Used in the archived `app.py` for geocoding landmarks. The live Calendarific refresh (`refresh_holiday_cache.py`) uses the standard library only.
  * `openpyxl`: **NOT USED** (all data ingest and exports use native JSON, CSV, and in-memory structures).
  * `holidays`: **NOT USED** (holiday detection relies on the curated `holiday_cache.json` derived from Calendarific).

### 1.2 Backend Dependencies ([`backend/package.json`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/package.json))
* **Node.js Runtime:** Node.js v18+ / v20+ LTS
* **Dependencies:**
  * `express`: `^4.21.0`
  * `sequelize`: `^6.37.8`
  * `mysql2`: `^3.24.2`
  * `pg`: `^8.20.0`
  * `pg-hstore`: `^2.3.4`
  * `jsonwebtoken`: `^9.0.2`
  * `bcryptjs`: `^2.4.3`
  * `cors`: `^2.8.5`
  * `dotenv`: `^16.4.5`
  * `axios`: `^1.7.7`
  * `multer`: `^2.0.1`
  * `form-data`: `^4.0.1`
* **DevDependencies:**
  * `nodemon`: `^3.1.7`

### 1.3 Frontend Dependencies ([`frontend/package.json`](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/package.json))
* **Core Framework:** `react`: `^18.3.1`, `react-dom`: `^18.3.1`
* **Build Tool:** `vite`: `^6.0.3` (with `@vitejs/plugin-react`: `^4.3.4`)
* **Styling:** `tailwindcss`: `^3.4.0`, `postcss`: `^8.4.0`, `autoprefixer`: `^10.4.0`
* **Geographical Mapping:** `leaflet`: `^1.9.4`, `react-leaflet`: `^4.2.1`
* **Data Visualization & Charts:** `recharts`: `^2.12.0`
* **Navigation & Routing:** `react-router-dom`: `^6.28.0`
* **Icons & PDF Generation:** `lucide-react`: `^0.453.0`, `jspdf`: `^4.2.1`, `html2canvas`: `^1.4.1`
* **Production Static Server:** `serve`: `^14.2.4`

---

## 2. Provenance of Holiday Data

### 2.1 Generation Mechanism
**Authoritative copy: `forecasting dashboard/holiday_cache.json`.** It is the only copy the live forecast path reads (`waste_forecast/src/calendar_features.py:11`, via `get_holiday_cache_path()`), and the one `refresh_holiday_cache.py` writes. It is populated from the **Calendarific API** for Sri Lanka (`country="LK"`) and covers 2023-2027.

Two other copies exist, and no code reads either: `backend/holiday_cache.json` (byte-identical to the authoritative file as of 2026-10-19) and `web/lib/data/holiday_cache.json` (an older subset holding only 2024 and 2026, identical to the authoritative entries for those years). Neither is updated by the refresh script.

The cache is refreshed by `waste_forecast/src/refresh_holiday_cache.py` (extracted from the archived Dash prototype `app.py`). It reads `CALENDARIFIC_API_KEY` from the environment, re-fetches the requested years, keeps the other years, and writes nothing if any year fails:

```powershell
python waste_forecast/src/refresh_holiday_cache.py --years 2027 2028 --dry-run   # report changes only
python waste_forecast/src/refresh_holiday_cache.py --years 2027 2028             # write the cache
```

### 2.2 Distinct `primary_type` Categories
Inspection of all 987 lines across years 2023 to 2027 in `holiday_cache.json` reveals exactly **four** distinct `primary_type` values:
1. `"National holiday"` (Full Moon Poya days, New Year, National Day, religious holidays)
2. `"Observance"` (Valentine's Day, Ramadan Start, Mother's Day, Father's Day, Christmas Eve)
3. `"Hinduism"` (Holi, Raksha Bandhan, Ganesh Chaturthi, Dussehra)
4. `"Season"` (March Equinox, June Solstice, September Equinox, December Solstice)

---

## 3. Dashboard Implementation (Section 5.2.6)

### 3.1 ForecastPage.js ([`frontend/src/pages/ForecastPage.js`](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/ForecastPage.js))
* **UI Components:**
  * **Header & Date Controls:** Standard HTML5 date picker input and quick buttons for "Today" and "Tomorrow".
  * **Summary KPI Cards (`StatCard`):** Displays Total Predicted Waste, Average Per Site, and High/Very High Risk Sites count.
  * **Interactive Geographical Map:** Renders an interactive map of Sri Lanka centering on Western Province coordinates (`lat: 6.83, lng: 79.92`), drawing circular markers for 8 local councils.
  * **Regional Breakdown Cards (`InsightCard`):** Displays council-specific predictions in KG, status badges, and baseline comparisons (% above historical high / median).
  * **Category Breakdown Bar Chart:** Visualizes distribution across the 8 waste categories.
* **Libraries Used:**
  * Map: `react-leaflet` (`MapContainer`, `TileLayer`, `CircleMarker`, `Popup`, `Tooltip`).
  * Chart: `recharts` (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`).
  * Icons: `lucide-react`.
* **API Invocations:** `GET /api/waste-data?date=YYYY-MM-DD` ([ForecastPage.js:L163](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/ForecastPage.js#L163)).
* **Status Classification Rule:** Decided on the backend in [`backend/utils/wasteStatus.js:L98-L110`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/utils/wasteStatus.js#L98-L110):
  ```javascript
  if (predictedWasteKg < baseline.q1Kg) {
    status = "LOW";        // #3b82f6 (Blue)
  } else if (predictedWasteKg < baseline.q3Kg) {
    status = "NORMAL";     // #22c55e (Green)
  } else if (predictedWasteKg < baseline.p90Kg) {
    status = "HIGH";       // #f97316 (Orange)
  } else {
    status = "VERY_HIGH";  // #ef4444 (Red)
  }
  ```
* **Daily Estimate / Reliability Label:** 
  In [`frontend/src/pages/ForecastPage.js:L234`](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/ForecastPage.js#L234), a warning alert is rendered when `reliability === "out_of_range"`:
  ```jsx
  <span><strong>Forecast Horizon Notice:</strong> {data?.reliabilityNote || "The selected date exceeds the 12-month reliable forecast horizon (2023-01 to 2026-12). Showing nearest reliable forecast."}</span>
  ```

### 3.2 WasteUpdatePage.js ([`frontend/src/pages/WasteUpdatePage.js`](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js))
* **UI Components:**
  * **Model Retrain Monitor Card:** Live version indicator (e.g. `v1.2`), progress meter bar toward 30-entry retraining threshold (`unprocessedCount / threshold`), and manual retraining trigger button.
  * **Retrain Outcome Banner:** Displays candidate vs live RMSE and promotion status.
  * **Add Waste Entry Form:** Input fields for Date, Vehicle Number (with live regex validation error display), Location dropdown, Category dropdown, and Weight in KG.
  * **Past Waste Entries Table:** Paginated table listing recorded entries with badges ("Processed for Training" vs "Pending"), inline editing mode, and delete confirmation modal dialogs.
* **Libraries Used:** React JSX, Tailwind CSS, Vanilla CSS (`WasteUpdatePage.css`), `lucide-react`.
* **API Invocations:**
  * `GET /api/waste-entries?limit=100` ([L97](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L97))
  * `GET /api/waste-entries/retrain-status` ([L85](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L85))
  * `POST /api/waste-entries` ([L157](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L157))
  * `POST /api/waste-entries/trigger-retrain` ([L191](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L191))
  * `PUT /api/waste-entries/:id` ([L222](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L222))
  * `DELETE /api/waste-entries/:id` ([L244](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/pages/WasteUpdatePage.js#L244))

### 3.3 DashboardInsights.js ([`frontend/src/components/DashboardInsights.js`](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/components/DashboardInsights.js))
* **UI Components:**
  * **4 Summary Insight Cards:** Peak Month (~33.9 tons in December), Dominant Categories (Burnable 38.5% + SOW 32.0%), Lowest Volume Site (KDU Campus 3.2%), and December Standout (Dehiwala 406.5 kg/day).
  * **15-Day Waste Trend Chart:** Interactive line chart showing -7 days historical reconstruction, selected day anchor, and +7 days forecast curve for any selected local authority.
  * **Council Selector:** Dropdown menu allowing selection among the 8 municipal councils.
* **Libraries Used:** `recharts` (`ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`), `lucide-react`.
* **API Invocations:**
  * `GET /api/waste-insights` ([L434](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/components/DashboardInsights.js#L434))
  * `GET /api/waste-trend?date=...&location=...` ([L196](file:///c:/Reasearch/SLIIT/R26-IT-084/frontend/src/components/DashboardInsights.js#L196))

---

## 4. Data Entry and Retraining (Section 5.2.5)

### 4.1 Input Validation Rules ([`backend/routes/wasteentries.routes.js`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/routes/wasteentries.routes.js))
In `POST /api/waste-entries`, validation is strictly enforced as follows:
* **Vehicle Registration Regex:**
  * Line 8: `const VEHICLE_REGEX = /^[A-Za-z0-9]{2,3} \d{4}$/;`
  * Lines 31-35: Enforces 2-3 alphanumeric characters, a single space, and 4 digits (e.g. `251 5678`, `HW 3628`, `ACC 2657`).
* **Date Format Validation:**
  * Lines 27-29: `if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date))` enforces strict `YYYY-MM-DD` ISO date string.
* **Location ID Validation:**
  * Lines 37-39: `if (!location_id || typeof location_id !== "string")` requires non-empty string.
* **Waste Type Validation:**
  * Lines 41-43: `if (!waste_type || typeof waste_type !== "string")` requires non-empty string.
* **Weight Validation:**
  * Lines 45-48: `const weightNum = Number(weight_kg); if (isNaN(weightNum) || weightNum <= 0)` ensures strictly positive numbers in kilograms.

### 4.2 Retraining Pipeline Invocations
* **Automatic Background Retrain (Threshold Trigger):**
  Triggered when `stats.unprocessedEntries >= 30` in [`backend/routes/wasteentries.routes.js:L61-L68`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/routes/wasteentries.routes.js#L61-L68):
  ```javascript
  if (stats.unprocessedEntries >= 30) {
    retrainTriggered = true;
    const { exec } = require("child_process");
    exec(`python waste_forecast/src/retrain_pipeline.py`, { cwd: REPO_ROOT }, (err) => {
      if (err) console.error("[waste-entries] Auto-retrain bg error:", err.message);
      else console.log("[waste-entries] Auto-retrain completed in background.");
    });
  }
  ```
  *Mechanism:* Asynchronous background process via `exec`, no arguments, non-blocking.
* **Manual Retrain (Force Trigger):**
  Triggered via `POST /api/waste-entries/trigger-retrain` in [`backend/routes/wasteentries.routes.js:L123-L126`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/routes/wasteentries.routes.js#L123-L126):
  ```javascript
  const output = execSync(`python waste_forecast/src/retrain_pipeline.py --force`, { cwd: REPO_ROOT, timeout: 30000 }).toString();
  ```
  *Mechanism:* Synchronous process via `execSync`, argument `--force`, timeout `30000` ms (30 seconds).

### 4.3 Model Loading Post-Retrain
* When the candidate trend model passes the validation gate (candidate holdout RMSE lower than the live model's), `retrain_pipeline.py` backs up the outgoing model to `waste_forecast/archive/trend_model.<timestamp>.json` and saves the candidate to:
  `waste_forecast/models/trend_model.json`
* Both `run_model.py` and `_run_trend.py` reach `trend_model.json` through `daily_forecast.py`, which loads it on every request. Therefore, subsequent prediction requests immediately evaluate against the newly promoted model without requiring a server reboot. (The former `model.json` is archived synthetic-era evidence and is not loaded (removed from the working tree; kept in git at `bacf3a3b`, see `waste_forecast/archive/README.md`).)

---

## 5. Deployment Architecture (Section 5.5)

### 5.1 Local Execution Commands & Ports
1. **Backend Gateway (Express.js):**
   ```powershell
   cd backend
   npm install
   npm start
   ```
   *Port:* `http://localhost:5000`
2. **Frontend Dashboard (Vite + React):**
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   *Port:* `http://localhost:3000` (Vite dev server with proxies to port 5000)
3. **Python Environment Setup:**
   ```powershell
   pip install pandas numpy scikit-learn scipy matplotlib
   # xgboost only if you run the archived legacy-model scripts
   ```

### 5.2 Cloud Hosting Environment
* Deployment is architected for **Railway** (`railway.app`):
  1. `backend`: Express.js service on Railway (builds and runs with `npm start`).
  2. `frontend`: SPA deployment (built using `npm run build` into `dist`, served with `serve` on port `$PORT`).
  3. `model-yolo`: Dockerfile container service on Railway.
  4. ESP32-CAM connects via local laptop bridge (`VisionWaste/bridge`) communicating with the Railway HTTPS API.

### 5.3 Required Environment Variables (Forecasting Component)
* **Backend:**
  * `PORT` (default `5000`)
  * `CORS_ORIGIN` (allowed origins)
  * `DATABASE_URL` (optional, for shared user/telemetry tables)
  * `NODE_ENV`
* **Frontend:**
  * `VITE_API_URL` (optional in local development; points to production backend HTTPS URL)
* **Standalone Analytics Prototype:**
  * `CALENDARIFIC_API_KEY` (optional, used to refresh Sri Lankan holiday cache from Calendarific)

---

## 6. Version Control Attribution

* **Git Remote URL:** `https://github.com/imashi2001/R26-IT-084.git`
* **Current Working Branch:** `adheeshana-IT22296214`
* **Total Commits by "adheeshana herath":** **19 commits**
* **Commit Date Range:** **August 20, 2026 – September 1, 2026** (Unix timestamps `1787137007` to `1788247620`)

---

## 7. Implementation Summary Table

| Layer | Technology (with versions) | Use |
| :--- | :--- | :--- |
| **Language** | Python 3.10+, JavaScript (ES6+ / Node.js 18+) | ML model engineering, backend API gateway, and frontend dashboard logic. |
| **Data handling** | pandas, numpy | Dataset preprocessing, monthly aggregation, rolling averages, feature table construction. |
| **Models** | Weighted OLS trend with unweighted calendar-month effects (`trend_model.json`, NumPy) | Monthly forecast of the eight-council aggregate, disaggregated to days with day-type weights. XGBoost is not used in the live path. |
| **Statistics** | scikit-learn, scipy | Time-series expanding window CV, permutation importance, bootstrap confidence intervals, baseline IQRs. |
| **Calendar** | Calendarific API, Custom Calendar Features (Python) | Sri Lankan national, poya, and bank holiday caching; weekend and bridge day feature engineering. |
| **Plots** | recharts (^2.12.0), matplotlib | Web dashboard trend lines and category bar charts; publication evaluation curve generation. |
| **Backend** | Express.js (^4.21.0), Node.js | RESTful API gateway connecting ML Python scripts, data entry repositories, and frontend requests. |
| **Database/Storage** | JSON file storage (fs), Sequelize ORM (^6.37.8) | Local JSON persistence for waste collection entries and model registry; optional relational DB for system telemetry. |
| **Dashboard** | React (^18.3.1), Vite (^6.0.3), Tailwind CSS (^3.4.0) | Single-page reactive user interface, responsive stat cards, CRUD forms, and insight layouts. |
| **Map and charts** | Leaflet (^1.9.4), React-Leaflet (^4.2.1), Recharts (^2.12.0) | Interactive geographical map for 8 local authority clusters and animated composition charts. |
| **Tools** | Git, npm, Railway, Lucide React (^0.453.0) | Source code version control, package management, cloud microservice deployment, UI iconography. |
